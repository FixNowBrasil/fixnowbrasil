-- QUOTES
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  estimated_time text,
  message text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes read by parties" ON public.quotes FOR SELECT TO authenticated
USING (
  provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  OR request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "provider creates quote" ON public.quotes FOR INSERT TO authenticated
WITH CHECK (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));
CREATE POLICY "quote update by parties" ON public.quotes FOR UPDATE TO authenticated
USING (
  provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  OR request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid())
)
WITH CHECK (
  provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  OR request_id IN (SELECT id FROM public.service_requests WHERE client_id = auth.uid())
);

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages read by parties" ON public.messages FOR SELECT TO authenticated
USING (
  request_id IN (
    SELECT id FROM public.service_requests
    WHERE client_id = auth.uid()
       OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  )
);
CREATE POLICY "messages sent by parties" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND request_id IN (
    SELECT id FROM public.service_requests
    WHERE client_id = auth.uid()
       OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  )
);
CREATE POLICY "messages marked read by parties" ON public.messages FOR UPDATE TO authenticated
USING (
  request_id IN (
    SELECT id FROM public.service_requests
    WHERE client_id = auth.uid()
       OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  request_id IN (
    SELECT id FROM public.service_requests
    WHERE client_id = auth.uid()
       OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  )
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ADDRESSES
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Casa',
  street text NOT NULL DEFAULT '',
  number text,
  complement text,
  neighborhood text,
  city text NOT NULL DEFAULT '',
  state text,
  zip text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own addresses" ON public.addresses FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- BLOCKED FLAG
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- ADMIN POWERS
CREATE POLICY "admin reads profiles" ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates profiles" ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin updates providers" ON public.providers FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin inserts providers" ON public.providers FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin manages categories" ON public.categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages services" ON public.services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin deletes reviews" ON public.reviews FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
GRANT DELETE ON public.reviews TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();