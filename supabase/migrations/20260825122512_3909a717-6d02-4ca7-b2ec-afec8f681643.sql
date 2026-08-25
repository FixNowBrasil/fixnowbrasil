-- 1) Reviews must be tied to a real completed request of the reviewing client
create or replace function public.validate_review_insert()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  actor uuid := auth.uid();
  r public.service_requests%rowtype;
begin
  if public.has_role('admin', actor) then return new; end if;
  if actor is null then raise exception 'Authentication required to post a review'; end if;
  if public.is_blocked(actor) then raise exception 'Blocked account'; end if;

  new.client_id := actor;

  if new.request_id is null then
    raise exception 'A review must reference a service request';
  end if;

  select * into r from public.service_requests where id = new.request_id;
  if not found then raise exception 'Request not found'; end if;
  if r.client_id <> actor then raise exception 'Only the client of this request can review it'; end if;
  if r.provider_id is null or new.provider_id is distinct from r.provider_id then
    raise exception 'Review provider must match the provider of the request';
  end if;
  if r.status not in ('completed', 'rated') then
    raise exception 'Request must be completed before rating';
  end if;
  if exists (select 1 from public.reviews rv where rv.request_id = new.request_id) then
    raise exception 'This request has already been reviewed';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_review_insert on public.reviews;
create trigger validate_review_insert
before insert on public.reviews
for each row execute function public.validate_review_insert();

create unique index if not exists reviews_request_id_unique on public.reviews (request_id) where request_id is not null;

-- 2) request_locations insert policy tautology
drop policy if exists "location insert by provider" on public.request_locations;
create policy "location insert by provider"
on public.request_locations
for insert
to authenticated
with check (
  provider_id in (select p.id from public.providers p where p.user_id = auth.uid())
  and exists (
    select 1 from public.service_requests sr
    where sr.id = request_id
      and sr.provider_id = request_locations.provider_id
  )
);

-- 3) SECURITY DEFINER functions: only intended RPCs stay callable
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.notify_on_message() from public, anon, authenticated;
revoke all on function public.notify_on_quote() from public, anon, authenticated;
revoke all on function public.notify_on_request() from public, anon, authenticated;
revoke all on function public.increment_provider_jobs_done() from public, anon, authenticated;
revoke all on function public.recalculate_provider_rating() from public, anon, authenticated;
revoke all on function public.release_payment_on_completion() from public, anon, authenticated;
revoke all on function public.validate_review_insert() from public, anon, authenticated;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.has_role(public.app_role, uuid) from public, anon;
revoke all on function public.is_blocked(uuid) from public, anon;
revoke all on function public.is_invited_provider(uuid, uuid) from public, anon;
revoke all on function public.is_request_client(uuid, uuid) from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(public.app_role, uuid) to authenticated;
grant execute on function public.is_blocked(uuid) to authenticated;
grant execute on function public.is_invited_provider(uuid, uuid) to authenticated;
grant execute on function public.is_request_client(uuid, uuid) to authenticated;

revoke all on function public.confirm_payment(uuid, text) from public, anon;
revoke all on function public.create_payment_for_quote(uuid, text) from public, anon;
grant execute on function public.confirm_payment(uuid, text) to authenticated;
grant execute on function public.create_payment_for_quote(uuid, text) to authenticated;