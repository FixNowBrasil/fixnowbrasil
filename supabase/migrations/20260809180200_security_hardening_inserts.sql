-- Follow-up hardening for INSERT paths so moderation and ownership cannot be bypassed at creation time.

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

  if not exists (select 1 from public.user_roles ur where ur.user_id = new.id and ur.role = assigned_role) then
    insert into public.user_roles (user_id, role) values (new.id, assigned_role);
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_moderation_fields()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if not public.has_role('admin', auth.uid()) then
    if tg_op = 'INSERT' and coalesce(new.blocked, false) then
      raise exception 'A new profile cannot be created as blocked';
    end if;
    if tg_op = 'UPDATE' then
      if new.id <> old.id then
        raise exception 'Profile ownership cannot be changed';
      end if;
      if new.blocked is distinct from old.blocked then
        raise exception 'Only an administrator can change the blocked flag';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_moderation_fields on public.profiles;
create trigger protect_profile_moderation_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_moderation_fields();

create or replace function public.protect_provider_moderation_fields()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if not public.has_role('admin', auth.uid()) then
    if tg_op = 'INSERT' then
      if coalesce(new.approved, false) or coalesce(new.verified, false)
         or coalesce(new.rating, 0) <> 0 or coalesce(new.reviews_count, 0) <> 0
         or coalesce(new.jobs_done, 0) <> 0 then
        raise exception 'Provider moderation fields are administrator controlled';
      end if;
    else
      if new.id <> old.id or new.user_id is distinct from old.user_id then
        raise exception 'Provider ownership cannot be changed';
      end if;
      if new.approved is distinct from old.approved
         or new.verified is distinct from old.verified
         or new.rating is distinct from old.rating
         or new.reviews_count is distinct from old.reviews_count
         or new.jobs_done is distinct from old.jobs_done then
        raise exception 'Marketplace moderation fields are administrator controlled';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_provider_moderation_fields on public.providers;
create trigger protect_provider_moderation_fields
before insert or update on public.providers
for each row execute function public.protect_provider_moderation_fields();

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

  select p.id into actor_provider_id from public.providers p where p.user_id = actor;

  if tg_op = 'INSERT' then
    if new.client_id <> actor then raise exception 'Request must belong to the signed-in client'; end if;
    if new.status <> 'sent' then raise exception 'New requests must start in sent status'; end if;
    if new.provider_id is not null then
      if not exists (select 1 from public.providers p where p.id = new.provider_id and p.approved = true) then
        raise exception 'Selected provider is not approved';
      end if;
    end if;
    return new;
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception 'Request ownership cannot be changed';
  end if;

  if old.client_id = actor then
    if old.provider_id is not null and new.provider_id is distinct from old.provider_id then
      raise exception 'Assigned provider cannot be replaced by the client';
    end if;
    if new.status is distinct from old.status
       and not (new.status = 'cancelled' and old.status in ('sent','analyzing','confirmed')) then
      raise exception 'Client cannot perform this status transition';
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
before insert or update on public.service_requests
for each row execute function public.validate_service_request_update();

create or replace function public.validate_quote_update()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_provider_id uuid;
  request_client_id uuid;
begin
  if public.has_role('admin', actor) then return new; end if;

  select p.id into actor_provider_id from public.providers p where p.user_id = actor;
  select r.client_id into request_client_id from public.service_requests r where r.id = coalesce(new.request_id, old.request_id);

  if tg_op = 'INSERT' then
    if actor_provider_id is null or new.provider_id <> actor_provider_id then
      raise exception 'Only the assigned provider can create a quote';
    end if;
    if new.status not in ('pending','sent') then
      raise exception 'New quotes must start pending or sent';
    end if;
    return new;
  end if;

  if new.id <> old.id or new.provider_id is distinct from old.provider_id or new.request_id is distinct from old.request_id then
    raise exception 'Quote ownership cannot be changed';
  end if;

  if actor_provider_id = old.provider_id then
    if old.status in ('accepted','rejected') and new.status is distinct from old.status then
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
    if new.status not in ('accepted','rejected') then
      raise exception 'Client can only accept or reject a quote';
    end if;
  else
    raise exception 'You are not a participant in this quote';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_quote_update on public.quotes;
create trigger validate_quote_update
before insert or update on public.quotes
for each row execute function public.validate_quote_update();
