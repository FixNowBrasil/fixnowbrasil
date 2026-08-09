-- Keep service-request status transitions authoritative at the database boundary.
-- The client-side lifecycle helper is only UX; authenticated clients must not be
-- able to skip states by writing an arbitrary status directly to service_requests.

create or replace function public.validate_service_request_status_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_provider_id uuid;
begin
  if public.has_role('admin', actor) then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  select p.id
    into actor_provider_id
  from public.providers p
  where p.user_id = actor;

  -- Client can cancel their own request, confirm it only after accepting a quote,
  -- and rate it only after the service is completed and a review exists.
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
      if not exists (
        select 1
        from public.quotes q
        where q.request_id = old.id
          and q.status = 'accepted'
      ) then
        raise exception 'An accepted quote is required before confirmation';
      end if;
      return new;
    end if;

    if new.status = 'rated' then
      if old.status <> 'completed' then
        raise exception 'Request must be completed before rating';
      end if;
      if not exists (
        select 1
        from public.reviews rv
        where rv.request_id = old.id
          and rv.client_id = actor
      ) then
        raise exception 'A review is required before marking the request as rated';
      end if;
      return new;
    end if;

    raise exception 'Client cannot make this request status transition';
  end if;

  -- Assigned provider owns the operational transitions.
  if actor_provider_id = old.provider_id then
    if new.status = 'analyzing' and old.status = 'sent' then
      return new;
    end if;

    if new.status = 'cancelled' and old.status in ('sent', 'analyzing', 'confirmed') then
      return new;
    end if;

    if new.status = 'on_the_way' and old.status = 'confirmed' then
      return new;
    end if;

    if new.status = 'in_progress' and old.status = 'on_the_way' then
      return new;
    end if;

    if new.status = 'completed' and old.status = 'in_progress' then
      return new;
    end if;

    raise exception 'Provider cannot make this request status transition';
  end if;

  raise exception 'You are not a participant in this request';
end;
$$;

drop trigger if exists trg_validate_service_request_status on public.service_requests;

create trigger trg_validate_service_request_status
before update of status on public.service_requests
for each row
execute function public.validate_service_request_status_update();

-- There can only be one accepted quote for a request. This prevents two clients
-- or duplicate UI submissions from producing conflicting confirmed prices.
create unique index if not exists quotes_one_accepted_per_request
on public.quotes (request_id)
where status = 'accepted';
