CREATE OR REPLACE FUNCTION public.create_request_with_matching(
  p_request_id uuid,
  p_service_id uuid,
  p_category_id uuid,
  p_need text,
  p_description text,
  p_photos text[],
  p_when_option text,
  p_scheduled_at timestamptz,
  p_address text,
  p_city text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  new_id uuid := coalesce(p_request_id, gen_random_uuid());
  invited integer := 0;
  effective_category uuid := p_category_id;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF public.is_blocked(actor) THEN RAISE EXCEPTION 'Blocked account'; END IF;
  IF coalesce(trim(p_description), '') = '' THEN RAISE EXCEPTION 'Description is required'; END IF;
  IF coalesce(trim(p_address), '') = '' THEN RAISE EXCEPTION 'Address is required'; END IF;
  IF p_when_option NOT IN ('now', 'scheduled') THEN RAISE EXCEPTION 'Invalid when_option'; END IF;
  IF p_when_option = 'scheduled' AND (p_scheduled_at IS NULL OR p_scheduled_at <= now()) THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;
  IF EXISTS (SELECT 1 FROM public.service_requests WHERE id = new_id) THEN
    RAISE EXCEPTION 'Request already exists';
  END IF;

  IF effective_category IS NULL AND p_service_id IS NOT NULL THEN
    SELECT s.category_id INTO effective_category FROM public.services s WHERE s.id = p_service_id;
  END IF;

  INSERT INTO public.service_requests (
    id, client_id, provider_id, service_id, category_id, need, description,
    photos, when_option, scheduled_at, address, status
  ) VALUES (
    new_id, actor, NULL, p_service_id, effective_category, nullif(trim(coalesce(p_need, '')), ''),
    trim(p_description), coalesce(p_photos, '{}'::text[]), p_when_option,
    CASE WHEN p_when_option = 'scheduled' THEN p_scheduled_at ELSE NULL END,
    trim(p_address), 'sent'
  );

  WITH ranked AS (
    SELECT
      pr.id,
      (
        CASE WHEN p_service_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.provider_services ps
          WHERE ps.provider_id = pr.id AND ps.service_id = p_service_id) THEN 40 ELSE 0 END
        + CASE WHEN p_city IS NOT NULL AND lower(public.unaccent_stub(pr.city)) = lower(public.unaccent_stub(p_city)) THEN 25 ELSE 0 END
        + CASE WHEN p_when_option = 'now' AND pr.available_now THEN 15 ELSE 0 END
        + CASE WHEN pr.verified THEN 10 ELSE 0 END
        + least(pr.rating * 2, 10)
        + least(pr.jobs_done / 100.0, 5)
        + least(pr.years_experience / 5.0, 3)
      )::numeric AS score
    FROM public.providers pr
    WHERE pr.approved = true
      AND (
        (p_service_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.provider_services ps
          WHERE ps.provider_id = pr.id AND ps.service_id = p_service_id))
        OR (effective_category IS NOT NULL AND pr.category_id = effective_category)
        OR (effective_category IS NULL AND p_service_id IS NULL)
      )
  ), top5 AS (
    SELECT id, score, row_number() OVER (ORDER BY score DESC, id) AS rn
    FROM ranked ORDER BY score DESC, id LIMIT 5
  )
  INSERT INTO public.request_invites (request_id, provider_id, rank, score)
  SELECT new_id, id, rn, score FROM top5
  ON CONFLICT (request_id, provider_id) DO NOTHING;

  GET DIAGNOSTICS invited = ROW_COUNT;

  IF invited = 0 THEN
    DELETE FROM public.service_requests WHERE id = new_id;
    RETURN jsonb_build_object('request_id', NULL, 'invited', 0);
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT pr.user_id, 'Nova solicitação de serviço',
         left(coalesce(nullif(trim(coalesce(p_need, '')), ''), trim(p_description)), 120),
         '/pedidos/' || new_id
  FROM public.request_invites i
  JOIN public.providers pr ON pr.id = i.provider_id
  WHERE i.request_id = new_id AND pr.user_id IS NOT NULL;

  RETURN jsonb_build_object('request_id', new_id, 'invited', invited);
END;
$$;