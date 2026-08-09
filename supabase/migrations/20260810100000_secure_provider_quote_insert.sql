-- A provider may quote only the request actually assigned to that provider.
-- The client UI is not a security boundary, so enforce this at the database layer.

create or replace function public.validate_quote_update()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
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
  where r.id = new.request_id;

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
    if old.status in ('accepted', 'rejected') and new.status is distinct from old.status then
      raise exception 'Finalized quote cannot be changed by the provider';
    end if;
  elsif request_client_id = actor then
    if new.amount is distinct from old.amount
       or new.provider_id is distinct from old.provider_id
       or new.request_id is distinct from old.request_id
       or new.message is distinct from old.message
       or new.estimated_time is distinct from old.estimated_time then
      raise exception 'Client can only change quote status';
    end if;
    if new.status not in ('accepted', 'rejected') then
      raise exception 'Client can only accept or reject a quote';
    end if;
  else
    raise exception 'You are not a participant in this quote';
  end if;

  return new;
end;
$$;
