-- FixNow: enforce service scheduling rules at the database boundary.
-- The UI performs a friendly availability check, but the database is the source of truth.

create or replace function public.validate_service_request_scheduling()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.has_role('admin', auth.uid()) then
    return new;
  end if;

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

-- Prevent two active requests from reserving the same provider/start time.
-- This closes the SELECT-then-UPDATE race in the client-side availability check.
create unique index if not exists service_requests_provider_scheduled_at_active_idx
on public.service_requests (provider_id, scheduled_at)
where provider_id is not null
  and scheduled_at is not null
  and status <> 'cancelled';
