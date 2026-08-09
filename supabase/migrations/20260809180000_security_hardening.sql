-- FixNow security hardening: auth roles, moderation fields and request lifecycle.

create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function public.has_role(public.app_role, uuid) from public;
grant execute on function public.has_role(public.app_role, uuid) to authenticated;

-- Never trust client-controlled raw_user_meta_data for admin authorization.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  assigned_role public.app_role := case when requested_role = 'provider' then 'provider' else 'client' end;
  full_name_value text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1));
begin
  insert into public.profiles (id, full_name, phone, city, avatar_url)
  values (
    new.id,
    full_name_value,
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, assigned_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Moderation flags are server/admin controlled.
create or replace function public.protect_profile_moderation_fields()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.id <> old.id then
    raise exception 'Profile ownership cannot be changed';
  end if;

  if new.blocked is distinct from old.blocked
     and not public.has_role('admin', auth.uid()) then
    raise exception 'Only an administrator can change the blocked flag';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_moderation_fields on public.profiles;
create trigger protect_profile_moderation_fields
before update on public.profiles
for each row execute function public.protect_profile_moderation_fields();

-- Provider approval, verification and marketplace counters are server/admin controlled.
create or replace function public.protect_provider_moderation_fields()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if new.id <> old.id or new.user_id is distinct from old.user_id then
    if not public.has_role('admin', auth.uid()) then
      raise exception 'Provider ownership cannot be changed';
    end if;
  end if;

  if not public.has_role('admin', auth.uid()) and (
    new.approved is distinct from old.approved
    or new.verified is distinct from old.verified
    or new.rating is distinct from old.rating
    or new.reviews_count is distinct from old.reviews_count
    or new.jobs_done is distinct from old.jobs_done
  ) then
    raise exception 'Marketplace moderation fields are administrator controlled';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_provider_moderation_fields on public.providers;
create trigger protect_provider_moderation_fields
before update on public.providers
for each row execute function public.protect_provider_moderation_fields();

-- Lock role assignment down to admins; the signup trigger above is SECURITY DEFINER.
alter table public.user_roles enable row level security;
drop policy if exists "Users can view own role" on public.user_roles;
drop policy if exists "Users can insert own role" on public.user_roles;
drop policy if exists "Users can update own role" on public.user_roles;
drop policy if exists "Users can delete own role" on public.user_roles;
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Users can view own role"
on public.user_roles for select to authenticated
using ((select auth.uid()) = user_id or (select public.has_role('admin', auth.uid())));
create policy "Admins manage roles"
on public.user_roles for all to authenticated
using ((select public.has_role('admin', auth.uid())))
with check ((select public.has_role('admin', auth.uid())));

-- Prevent clients/providers from changing request ownership or skipping lifecycle states.
create or replace function public.validate_service_request_update()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_provider_id uuid;
  is_admin boolean := public.has_role('admin', actor);
begin
  if is_admin then return new; end if;

  if new.client_id is distinct from old.client_id then
    raise exception 'Request ownership cannot be changed';
  end if;

  select p.id into actor_provider_id
  from public.providers p
  where p.user_id = actor;

  if old.client_id = actor then
    if old.provider_id is not null and new.provider_id is distinct from old.provider_id then
      raise exception 'Assigned provider cannot be replaced by the client';
    end if;

    if new.status is distinct from old.status then
      if not (new.status = 'cancelled' and old.status in ('sent','analyzing','confirmed')) then
        raise exception 'Client cannot perform this status transition';
      end if;
    end if;
  elsif actor_provider_id is not null and old.provider_id = actor_provider_id then
    if new.provider_id is distinct from old.provider_id then
      raise exception 'Provider assignment cannot be changed';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'sent' and new.status in ('analyzing','cancelled'))
      or (old.status = 'analyzing' and new.status in ('confirmed','cancelled'))
      or (old.status = 'confirmed' and new.status in ('on_the_way','cancelled'))
      or (old.status = 'on_the_way' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'Invalid provider status transition';
    end if;
  else
    raise exception 'You are not a participant in this request';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_service_request_update on public.service_requests;
create trigger validate_service_request_update
before update on public.service_requests
for each row execute function public.validate_service_request_update();
