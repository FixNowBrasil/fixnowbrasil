-- 1) Convites: uma solicitação -> vários profissionais
CREATE TABLE public.request_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  rank integer NOT NULL DEFAULT 1,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, provider_id)
);

GRANT SELECT ON public.request_invites TO authenticated;
GRANT ALL ON public.request_invites TO service_role;

ALTER TABLE public.request_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_request_invites_provider ON public.request_invites(provider_id);
CREATE INDEX idx_request_invites_request ON public.request_invites(request_id);

-- Helpers SECURITY DEFINER (evitam recursão entre as policies das duas tabelas)
CREATE OR REPLACE FUNCTION public.is_request_client(_request_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = _request_id AND r.client_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_invited_provider(_request_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.request_invites i
    JOIN public.providers p ON p.id = i.provider_id
    WHERE i.request_id = _request_id AND p.user_id = _user_id
  );
$$;

CREATE POLICY "invites read by parties" ON public.request_invites
FOR SELECT TO authenticated
USING (
  public.is_request_client(request_id, auth.uid())
  OR provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2) Profissional convidado pode ler a solicitação recebida
DROP POLICY "client reads own requests" ON public.service_requests;
CREATE POLICY "client reads own requests" ON public.service_requests
FOR SELECT TO authenticated
USING (
  auth.uid() = client_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid())
  OR public.is_invited_provider(id, auth.uid())
);

-- 3) Matching determinístico + criação da solicitação, em uma única operação
-- Pontuação (simples e previsível):
--   +40 serviço compatível (provider_services)
--   +25 mesma cidade do endereço do cliente
--   +15 available_now quando when_option = 'now'
--   +10 verified
--   + rating * 2                (máx 10)
--   + min(jobs_done / 100, 5)   (máx 5)
--   + min(years_experience/5, 3)(máx 3)
-- distance_km NÃO é usado: hoje é um valor estático de seed, não uma distância real.
-- radius_km fica reservado para quando houver latitude/longitude reais.
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
        + CASE WHEN p_city IS NOT NULL AND lower(unaccent_stub(pr.city)) = lower(unaccent_stub(p_city)) THEN 25 ELSE 0 END
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

-- Comparação de cidade sem depender da extensão unaccent
CREATE OR REPLACE FUNCTION public.unaccent_stub(_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(coalesce(_text, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');
$$;

REVOKE ALL ON FUNCTION public.create_request_with_matching(uuid,uuid,uuid,text,text,text[],text,timestamptz,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_request_with_matching(uuid,uuid,uuid,text,text,text[],text,timestamptz,text,text) TO authenticated;