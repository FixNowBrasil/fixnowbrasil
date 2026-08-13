DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','released','refunded','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  amount numeric NOT NULL CHECK (amount > 0),
  method text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  external_reference text,
  failure_reason text,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_quote_unique ON public.payments(quote_id);
CREATE INDEX IF NOT EXISTS payments_request_idx ON public.payments(request_id);
CREATE INDEX IF NOT EXISTS payments_client_idx ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS payments_provider_idx ON public.payments(provider_id);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their payments" ON public.payments;
CREATE POLICY "Participants can view their payments" ON public.payments
FOR SELECT TO authenticated
USING (
  client_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = payments.provider_id AND p.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_payment_for_quote(p_quote_id uuid, p_method text DEFAULT NULL)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
  existing public.payments%rowtype;
  created public.payments%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote not found'; end if;
  if q.status <> 'accepted' then raise exception 'Payment requires an accepted quote'; end if;

  select * into r from public.service_requests where id = q.request_id;
  if r.client_id <> auth.uid() then raise exception 'Only the client can pay this request'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'Blocked account'; end if;
  if r.provider_id is distinct from q.provider_id then raise exception 'Quote does not match the request provider'; end if;
  if p_method is not null and p_method not in ('pix','card') then raise exception 'Unsupported payment method'; end if;

  select * into existing from public.payments where quote_id = p_quote_id;
  if found then
    if existing.status in ('pending','failed') and p_method is not null then
      update public.payments set method = p_method, status = 'pending', failure_reason = null
       where id = existing.id returning * into existing;
    end if;
    return existing;
  end if;

  insert into public.payments (request_id, quote_id, client_id, provider_id, amount, method)
  values (r.id, q.id, r.client_id, q.provider_id, q.amount, p_method)
  returning * into created;

  return created;
end;
$$;

REVOKE ALL ON FUNCTION public.create_payment_for_quote(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_for_quote(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_payment(p_payment_id uuid, p_external_reference text DEFAULT NULL)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  pay public.payments%rowtype;
begin
  select * into pay from public.payments where id = p_payment_id;
  if not found then raise exception 'Payment not found'; end if;
  if pay.client_id <> auth.uid() then raise exception 'Only the client can confirm this payment'; end if;
  if pay.status = 'paid' then return pay; end if;
  if pay.status not in ('pending','failed') then raise exception 'Payment can no longer be confirmed'; end if;
  if pay.method is null then raise exception 'Choose a payment method first'; end if;

  update public.payments
     set status = 'paid', paid_at = now(), failure_reason = null,
         external_reference = coalesce(p_external_reference, external_reference)
   where id = pay.id
  returning * into pay;

  insert into public.notifications (user_id, title, body, link)
  select p.user_id, 'Pagamento confirmado', 'O cliente efetuou o pagamento do serviço.', '/pedidos/' || pay.request_id
  from public.providers p where p.id = pay.provider_id and p.user_id is not null;

  return pay;
end;
$$;

REVOKE ALL ON FUNCTION public.confirm_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_payment_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.payments
       set status = 'released', released_at = now()
     where request_id = new.id and status = 'paid';
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS release_payment_on_completion ON public.service_requests;
CREATE TRIGGER release_payment_on_completion AFTER UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.release_payment_on_completion();