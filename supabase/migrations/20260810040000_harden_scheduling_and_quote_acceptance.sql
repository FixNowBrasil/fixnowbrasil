-- Prevent double-booking the same provider at the same scheduled time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_requests_provider_scheduled_at_active
  ON public.service_requests (provider_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status <> 'cancelled';

-- Quote acceptance must go through the atomic accept_quote() RPC.
-- Direct client updates may reject an open quote, but cannot mark it accepted.
CREATE OR REPLACE FUNCTION public.validate_quote_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  actor_provider_id uuid;
  request_provider_id uuid;
  request_client_id uuid;
begin
  if public.has_role('admin', actor) then return new; end if;

  select p.id into actor_provider_id
  from public.providers p
  where p.user_id = actor;

  select r.provider_id, r.client_id
  into request_provider_id, request_client_id
  from public.service_requests r
  where r.id = case when tg_op = 'INSERT' then new.request_id else old.request_id end;

  if tg_op = 'INSERT' then
    if actor_provider_id is null
       or new.provider_id <> actor_provider_id
       or request_provider_id is distinct from actor_provider_id then
      raise exception 'Only the assigned provider can create a quote';
    end if;

    if new.status not in ('pending', 'sent') then
      raise exception 'New quotes must start pending or sent';
    end if;

    return new;
  end if;

  if new.id <> old.id
     or new.provider_id is distinct from old.provider_id
     or new.request_id is distinct from old.request_id then
    raise exception 'Quote ownership cannot be changed';
  end if;

  if actor_provider_id = old.provider_id then
    if old.status in ('accepted', 'rejected') then
      if new.amount is distinct from old.amount
         or new.estimated_time is distinct from old.estimated_time
         or new.message is distinct from old.message
         or new.status is distinct from old.status then
        raise exception 'Finalized quote cannot be changed by the provider';
      end if;
    elsif new.status not in ('pending', 'sent') then
      raise exception 'Provider cannot accept or reject their own quote';
    end if;

    return new;
  elsif request_client_id = actor then
    if old.status in ('accepted', 'rejected') then
      if new.status is distinct from old.status then
        raise exception 'Finalized quote cannot be changed by the client';
      end if;
      return new;
    end if;

    if new.amount is distinct from old.amount
       or new.provider_id is distinct from old.provider_id
       or new.request_id is distinct from old.request_id
       or new.message is distinct from old.message
       or new.estimated_time is distinct from old.estimated_time then
      raise exception 'Client can only change quote status';
    end if;

    if new.status = 'rejected' then
      return new;
    end if;

    if new.status = 'accepted' then
      raise exception 'Use accept_quote to accept a quote';
    end if;

    raise exception 'Client can only reject an open quote';
  else
    raise exception 'You are not a participant in this quote';
  end if;
end;
$function$;
