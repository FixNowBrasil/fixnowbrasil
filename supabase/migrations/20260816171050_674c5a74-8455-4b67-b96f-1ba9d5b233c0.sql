create or replace function public.accept_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
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
  if r.provider_id is distinct from q.provider_id then raise exception 'Quote does not match the request provider'; end if;
  if q.status = 'accepted' then return q; end if;
  if q.status <> 'sent' then raise exception 'Quote can no longer be accepted'; end if;
  if r.status not in ('analyzing', 'confirmed') then
    raise exception 'Request must be under analysis before accepting a quote';
  end if;

  update public.quotes set status = 'rejected'
   where request_id = q.request_id and id <> q.id and status = 'sent';

  update public.quotes set status = 'accepted' where id = q.id returning * into q;

  if r.status = 'analyzing' then
    update public.service_requests
       set status = 'confirmed', price_estimate = q.amount, updated_at = now()
     where id = r.id;
  end if;

  return q;
end;
$$;

grant execute on function public.accept_quote(uuid) to authenticated;

create or replace function public.submit_review(
  p_request_id uuid,
  p_rating integer,
  p_punctuality integer,
  p_quality integer,
  p_service integer,
  p_comment text default null,
  p_author_name text default 'Cliente FixNow'
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.service_requests%rowtype;
  created public.reviews%rowtype;
begin
  select * into r from public.service_requests where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.client_id <> auth.uid() then raise exception 'Only the client can review this request'; end if;
  if public.is_blocked(auth.uid()) then raise exception 'Blocked account'; end if;
  if r.provider_id is null then raise exception 'Request has no provider'; end if;
  if r.status <> 'completed' then raise exception 'Request must be completed before rating'; end if;
  if exists (select 1 from public.reviews rv where rv.request_id = r.id) then
    raise exception 'This request has already been reviewed';
  end if;
  if p_rating not between 1 and 5
     or p_punctuality not between 1 and 5
     or p_quality not between 1 and 5
     or p_service not between 1 and 5 then
    raise exception 'Ratings must be between 1 and 5';
  end if;

  insert into public.reviews (provider_id, request_id, client_id, author_name, rating, punctuality, quality, service, comment)
  values (r.provider_id, r.id, auth.uid(), coalesce(nullif(trim(p_author_name), ''), 'Cliente FixNow'),
          p_rating, p_punctuality, p_quality, p_service, nullif(trim(coalesce(p_comment, '')), ''))
  returning * into created;

  update public.service_requests set status = 'rated', updated_at = now() where id = r.id;

  return created;
end;
$$;

grant execute on function public.submit_review(uuid, integer, integer, integer, integer, text, text) to authenticated;

create or replace function public.validate_service_request_status_update()
returns trigger
language plpgsql
set search_path = public
as $$
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
      if old.status <> 'analyzing' then
        raise exception 'Request must be under analysis before confirmation';
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
$$;