-- Prevent operational status transitions before an immediate service is due
-- or before a scheduled service reaches its scheduled time.

CREATE OR REPLACE FUNCTION public.validate_service_request_status_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := auth.uid();
  actor_provider_id uuid;
  execution_ready boolean;
BEGIN
  IF public.has_role('admin', actor) THEN
    RETURN new;
  END IF;

  IF new.status IS NOT DISTINCT FROM old.status THEN
    RETURN new;
  END IF;

  SELECT p.id INTO actor_provider_id
  FROM public.providers p
  WHERE p.user_id = actor;

  IF actor = old.client_id THEN
    IF new.status = 'cancelled' THEN
      IF old.status NOT IN ('sent', 'analyzing', 'confirmed') THEN
        RAISE EXCEPTION 'Request can no longer be cancelled';
      END IF;
      RETURN new;
    END IF;

    IF new.status = 'confirmed' THEN
      IF old.status <> 'analyzing' THEN
        RAISE EXCEPTION 'Request must be under analysis before confirmation';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.quotes q
        WHERE q.request_id = old.id AND q.status = 'accepted'
      ) THEN
        RAISE EXCEPTION 'An accepted quote is required before confirmation';
      END IF;
      RETURN new;
    END IF;

    IF new.status = 'rated' THEN
      IF old.status <> 'completed' THEN
        RAISE EXCEPTION 'Request must be completed before rating';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.reviews rv
        WHERE rv.request_id = old.id AND rv.client_id = actor
      ) THEN
        RAISE EXCEPTION 'A review is required before marking the request as rated';
      END IF;
      RETURN new;
    END IF;

    RAISE EXCEPTION 'Client cannot make this request status transition';
  END IF;

  IF actor_provider_id = old.provider_id THEN
    IF new.status = 'analyzing' AND old.status = 'sent' THEN
      RETURN new;
    END IF;

    IF new.status = 'cancelled' AND old.status IN ('sent', 'analyzing', 'confirmed') THEN
      RETURN new;
    END IF;

    execution_ready := (
      COALESCE(old.when_option, 'now') = 'now'
      OR (old.scheduled_at IS NOT NULL AND old.scheduled_at <= now())
    );

    IF new.status = 'on_the_way' AND old.status = 'confirmed' THEN
      IF NOT execution_ready THEN
        RAISE EXCEPTION 'Scheduled service cannot start before its scheduled time';
      END IF;
      RETURN new;
    END IF;

    IF new.status = 'in_progress' AND old.status = 'on_the_way' THEN
      IF NOT execution_ready THEN
        RAISE EXCEPTION 'Service cannot begin before its scheduled time';
      END IF;
      RETURN new;
    END IF;

    IF new.status = 'completed' AND old.status = 'in_progress' THEN
      IF NOT execution_ready THEN
        RAISE EXCEPTION 'Service cannot be completed before its scheduled time';
      END IF;
      RETURN new;
    END IF;

    RAISE EXCEPTION 'Provider cannot make this request status transition';
  END IF;

  RAISE EXCEPTION 'You are not a participant in this request';
END;
$function$;
