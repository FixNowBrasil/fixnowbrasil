-- =========================================================
-- FixNow: hardening consolidado (P0 + P1)
-- =========================================================

-- 1. has_role em duas assinaturas, ambas SECURITY DEFINER
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;
grant execute on function public.has_role(public.app_role, uuid) to authenticated, anon;

create or replace function public.is_blocked(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.blocked from public.profiles p where p.id = _user_id), false);
$$;

grant execute on function public.is_blocked(uuid) to authenticated;

-- 2. signup: nunca aceitar admin vindo de metadados
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

-- 3. moderação de perfis
create or replace function public.protect_profile_moderation_fields()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if coalesce(current_setting('fixnow.system_update', true), '') = 'on' then
    return new;
  end if;
  if not public.has_role('admin', auth.uid()) then
    if tg_op = 'INSERT' then
      if coalesce(new.blocked, false) then
        raise exception 'Only an administrator can change the blocked flag';
      end if;
    else
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

-- 4. moderação de prestadores
create or replace function public.protect_provider_moderation_fields()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if coalesce(current_setting('fixnow.system_update', true), '') = 'on' then
    return new;
  end if;
  if not public.has_role('admin', auth.uid()) then
    if tg_op = 'INSERT' then
      if coalesce(new.approved, false) or coalesce(new.verified, false)
         or coalesce(new.reviews_count, 0) <> 0 or coalesce(new.jobs_done, 0) <> 0 then
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

-- 5. pedidos: propriedade e criação (status é validado no trigger dedicado)
create or replace function public.validate_service_request_update()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_provider_id uuid;
begin
  if public.has_role('admin', actor) then return new; end if;

  select p.id into actor_provider_id from public.providers p where p.user_id = actor;

  if tg_op = 'INSERT' then
    if new.client_id <> actor then raise exception 'Request must belong to the signed-in client'; end if;
    if public.is_blocked(actor) then raise exception 'Blocked account'; end if;
    if new.status <> 'sent' then raise exception 'New requests must start in sent status'; end if;
    if new.provider_id is not null and not exists (
      select 1 from public.providers p where p.id = new.provider_id and p.approved = true
    ) then
      raise exception 'Selected provider is not approved';
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
  elsif actor_provider_id is not null and old.provider_id = actor_provider_id then
    if new.provider_id is distinct from old.provider_id then
      raise exception 'Provider assignment cannot be changed';
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

-- 6. pedidos: máquina de estados (autoridade final)
create or replace function public.validate_service_request_status_update()
returns trigger
language plpgsql security invoker
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
    if new.status = 'on_the_way' and old.status = 'confirmed' then return new; end if;
    if new.status = 'in_progress' and old.status = 'on_the_way' then return new; end if;
    if new.status = 'completed' and old.status = 'in_progress' then return new; end if;
    raise exception 'Provider cannot make this request status transition';
  end if;

  raise exception 'You are not a participant in this request';
end;
$$;

drop trigger if exists trg_validate_service_request_status on public.service_requests;
create trigger trg_validate_service_request_status
before update of status on public.service_requests
for each row execute function public.validate_service_request_status_update();

-- 7. agendamento
create or replace function public.validate_service_request_scheduling()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if public.has_role('admin', auth.uid()) then return new; end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    if old.client_id <> auth.uid() then
      raise exception 'Only the request owner can schedule this service';
    end if;
    if new.provider_id is null then
      raise exception 'A provider is required before scheduling';
    end if;
    if new.status <> 'confirmed' then
      raise exception 'A service must be confirmed before scheduling';
    end if;
    if new.scheduled_at is null then
      raise exception 'A scheduled time cannot be cleared from the client flow';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'Scheduled time must be in the future';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_service_request_scheduling on public.service_requests;
create trigger validate_service_request_scheduling
before update on public.service_requests
for each row execute function public.validate_service_request_scheduling();

create unique index if not exists service_requests_provider_scheduled_at_active_idx
on public.service_requests (provider_id, scheduled_at)
where provider_id is not null and scheduled_at is not null and status <> 'cancelled';

-- 8. preço do pedido preso ao orçamento aceito
create or replace function public.validate_service_request_price()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if public.has_role('admin', auth.uid()) then return new; end if;

  if new.price_estimate is distinct from old.price_estimate then
    if old.client_id <> auth.uid()
       or not exists (
         select 1 from public.quotes q
         where q.request_id = old.id and q.status = 'accepted' and q.amount = new.price_estimate
       ) then
      raise exception 'Price estimate must match an accepted quote';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_service_request_price on public.service_requests;
create trigger validate_service_request_price
before update on public.service_requests
for each row execute function public.validate_service_request_price();

-- 9. orçamentos
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

  select p.id into actor_provider_id from public.providers p where p.user_id = actor;

  select r.provider_id, r.client_id into request_provider_id, request_client_id
  from public.service_requests r where r.id = coalesce(new.request_id, old.request_id);

  if tg_op = 'INSERT' then
    if public.is_blocked(actor) then raise exception 'Blocked account'; end if;
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
$$;

-- Limpeza: mantém apenas o orçamento aceito mais recente por pedido.
update public.quotes q
   set status = 'rejected'
 where q.status = 'accepted'
   and q.id <> (
     select q2.id from public.quotes q2
      where q2.request_id = q.request_id and q2.status = 'accepted'
      order by q2.created_at desc, q2.id desc
      limit 1
   );

create unique index if not exists quotes_one_accepted_per_request
on public.quotes (request_id) where status = 'accepted';

drop trigger if exists validate_quote_update on public.quotes;
create trigger validate_quote_update
before insert or update on public.quotes
for each row execute function public.validate_quote_update();

-- 10. bloqueio de contas em mensagens e avaliações
create or replace function public.reject_blocked_author()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if public.is_blocked(auth.uid()) then
    raise exception 'Blocked account';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_blocked_message_author on public.messages;
create trigger reject_blocked_message_author
before insert on public.messages
for each row execute function public.reject_blocked_author();

drop trigger if exists reject_blocked_review_author on public.reviews;
create trigger reject_blocked_review_author
before insert on public.reviews
for each row execute function public.reject_blocked_author();

-- 11. reputação automática
create or replace function public.recalculate_provider_rating()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.provider_id, old.provider_id);
  avg_rating numeric;
  total integer;
begin
  select round(avg(rating)::numeric, 2), count(*) into avg_rating, total
  from public.reviews where provider_id = target;

  perform set_config('fixnow.system_update', 'on', true);
  update public.providers
     set rating = coalesce(avg_rating, 5.0),
         reviews_count = coalesce(total, 0)
   where id = target;
  perform set_config('fixnow.system_update', '', true);

  return coalesce(new, old);
end;
$$;

drop trigger if exists recalculate_provider_rating on public.reviews;
create trigger recalculate_provider_rating
after insert or update or delete on public.reviews
for each row execute function public.recalculate_provider_rating();

create or replace function public.increment_provider_jobs_done()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status and new.provider_id is not null then
    perform set_config('fixnow.system_update', 'on', true);
    update public.providers set jobs_done = jobs_done + 1 where id = new.provider_id;
    perform set_config('fixnow.system_update', '', true);
  end if;
  return new;
end;
$$;

drop trigger if exists increment_provider_jobs_done on public.service_requests;
create trigger increment_provider_jobs_done
after update of status on public.service_requests
for each row execute function public.increment_provider_jobs_done();

-- 12. papéis: admin pode gerenciar
alter table public.user_roles enable row level security;
drop policy if exists "own roles read" on public.user_roles;
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "own roles read" on public.user_roles
for select to authenticated
using (auth.uid() = user_id or public.has_role('admin', auth.uid()));
create policy "Admins manage roles" on public.user_roles
for all to authenticated
using (public.has_role('admin', auth.uid()))
with check (public.has_role('admin', auth.uid()));
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- 13. serviços do prestador: escrita para o dono e para o admin
grant select, insert, update, delete on public.provider_services to authenticated;
grant select on public.provider_services to anon;
grant all on public.provider_services to service_role;

drop policy if exists "provider manages own services" on public.provider_services;
create policy "provider manages own services" on public.provider_services
for all to authenticated
using (
  provider_id in (select p.id from public.providers p where p.user_id = auth.uid())
  or public.has_role('admin', auth.uid())
)
with check (
  provider_id in (select p.id from public.providers p where p.user_id = auth.uid())
  or public.has_role('admin', auth.uid())
);

-- 14. índices de consulta
create index if not exists idx_service_requests_client on public.service_requests (client_id, created_at desc);
create index if not exists idx_service_requests_provider on public.service_requests (provider_id, created_at desc);
create index if not exists idx_quotes_request on public.quotes (request_id, created_at desc);
create index if not exists idx_messages_request on public.messages (request_id, created_at);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_providers_category on public.providers (category_id) where approved = true;
create index if not exists idx_provider_services_provider on public.provider_services (provider_id);
create index if not exists idx_reviews_provider on public.reviews (provider_id, created_at desc);
create index if not exists idx_favorites_user on public.favorites (user_id);

-- 15. Storage: políticas dos três buckets privados
drop policy if exists "Users can upload their own request photos" on storage.objects;
create policy "Users can upload their own request photos" on storage.objects
for insert to authenticated
with check (bucket_id = 'service-request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Request participants can view request photos" on storage.objects;
create policy "Request participants can view request photos" on storage.objects
for select to authenticated
using (
  bucket_id = 'service-request-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.service_requests sr
      join public.providers p on p.id = sr.provider_id
      where sr.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete their own request photos" on storage.objects;
create policy "Users can delete their own request photos" on storage.objects
for delete to authenticated
using (bucket_id = 'service-request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "provider media is readable" on storage.objects;
create policy "provider media is readable" on storage.objects
for select to anon, authenticated
using (bucket_id in ('avatars', 'provider-work-photos'));

drop policy if exists "provider writes own media" on storage.objects;
create policy "provider writes own media" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('avatars', 'provider-work-photos')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "provider updates own media" on storage.objects;
create policy "provider updates own media" on storage.objects
for update to authenticated
using (
  bucket_id in ('avatars', 'provider-work-photos')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('avatars', 'provider-work-photos')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "provider deletes own media" on storage.objects;
create policy "provider deletes own media" on storage.objects
for delete to authenticated
using (
  bucket_id in ('avatars', 'provider-work-photos')
  and (storage.foldername(name))[1] = auth.uid()::text
);