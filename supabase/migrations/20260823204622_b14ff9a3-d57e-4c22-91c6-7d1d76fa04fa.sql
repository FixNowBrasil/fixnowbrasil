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
  is_invited boolean := false;
begin
  if public.has_role('admin', actor) then return new; end if;

  select p.id into actor_provider_id from public.providers p where p.user_id = actor;

  select r.provider_id, r.client_id into request_provider_id, request_client_id
  from public.service_requests r where r.id = coalesce(new.request_id, old.request_id);

  if tg_op = 'INSERT' then
    if public.is_blocked(actor) then raise exception 'Blocked account'; end if;
    if actor_provider_id is null or new.provider_id <> actor_provider_id then
      raise exception 'Only the provider can create a quote';
    end if;

    select exists (
      select 1 from public.request_invites i
      where i.request_id = new.request_id and i.provider_id = actor_provider_id
    ) into is_invited;

    if request_provider_id is distinct from actor_provider_id
       and not (request_provider_id is null and is_invited) then
      raise exception 'Only an assigned or invited provider can create a quote';
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

  if actor_provider_id is not null and actor_provider_id = old.provider_id then
    if old.status in ('accepted', 'rejected') and new.status is distinct from old.status then
      raise exception 'Finalized quote cannot be changed by the provider';
    end if;
  elsif request_client_id = actor then
    if new.amount is distinct from old.amount
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
$function$;

CREATE OR REPLACE FUNCTION public.validate_service_request_status_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  actor_provider_id uuid;
begin
  if public.has_role('admin', actor) then return new; end if;
  if new.status is not distinct from old.status then return new; end if;

  select p.id into actor_provider_id from public.providers p where p.user_id = actor;

  if actor = old.client_id then
    if new.status = 'cancelled' then
      if old.status not in ('sent', 'analyzing', 'confirmed') then
        raise exception 'Request can no longer be cancelled';
      end if;
      return new;
    end if;

    if new.status = 'confirmed' then
      if old.status not in ('sent', 'analyzing') then
        raise exception 'Request must be pending before confirmation';
      end if;
      if not exists (select 1 from public.quotes q where q.request_id = old.id and q.status = 'accepted') then
        raise exception 'An accepted quote is required before confirmation';
      end if;
      return new;
    end if;

    if new.status = 'rated' then
      if old.status <> 'completed' then
        raise exception 'Request must be completed before rating';
      end if;
      if not exists (select 1 from public.reviews rv where rv.request_id = old.id and rv.client_id = actor) then
        raise exception 'A review is required before marking the request as rated';
      end if;
      return new;
    end if;

    raise exception 'Client cannot make this request status transition';
  end if;

  if actor_provider_id is not null and actor_provider_id = old.provider_id then
    if new.status = 'analyzing' and old.status = 'sent' then return new; end if;
    if new.status = 'cancelled' and old.status in ('sent', 'analyzing', 'confirmed') then return new; end if;
    if new.status = 'on_the_way' and old.status = 'confirmed' then
      if not exists (
        select 1 from public.payments pm
        where pm.request_id = old.id and pm.status in ('paid', 'released')
      ) then
        raise exception 'Payment must be confirmed before starting the service';
      end if;
      return new;
    end if;
    if new.status = 'in_progress' and old.status = 'on_the_way' then return new; end if;
    if new.status = 'completed' and old.status = 'in_progress' then return new; end if;
    raise exception 'Provider cannot make this request status transition';
  end if;

  raise exception 'You are not a participant in this request';
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_quote(p_quote_id uuid)
 RETURNS quotes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote not found'; end if;

  select * into r from public.service_requests where id = q.request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.client_id <> auth.uid() then raise exception 'Only the client can accept this quote'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'Blocked account'; end if;
  if r.provider_id is not null and r.provider_id is distinct from q.provider_id then
    raise exception 'This request already has a chosen provider';
  end if;
  if q.status = 'accepted' then return q; end if;
  if q.status <> 'sent' then raise exception 'Quote can no longer be accepted'; end if;
  if r.status not in ('sent', 'analyzing', 'confirmed') then
    raise exception 'Request can no longer receive a chosen provider';
  end if;
  if exists (select 1 from public.quotes o where o.request_id = q.request_id and o.status = 'accepted') then
    raise exception 'A quote was already accepted for this request';
  end if;

  update public.quotes set status = 'rejected'
   where request_id = q.request_id and id <> q.id and status in ('pending', 'sent');

  update public.quotes set status = 'accepted' where id = q.id returning * into q;

  update public.service_requests
     set provider_id = coalesce(provider_id, q.provider_id),
         status = case when status in ('sent', 'analyzing') then 'confirmed'::request_status else status end,
         price_estimate = q.amount,
         updated_at = now()
   where id = r.id;

  insert into public.notifications (user_id, title, body, link)
  select p.user_id, 'Você foi escolhido!', 'O cliente aceitou seu orçamento. Combine os próximos detalhes.', '/pedidos/' || r.id
  from public.providers p where p.id = q.provider_id and p.user_id is not null;

  return q;
end;
$function$;