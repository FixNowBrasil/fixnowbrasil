-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('draft','pending','under_review','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_step AS ENUM ('personal','identity','selfie','address','professional','financial','review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.liveness_status AS ENUM ('not_started','pending','passed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABELA PRINCIPAL ============
CREATE TABLE public.provider_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES public.providers(id) ON DELETE CASCADE,
  status public.verification_status NOT NULL DEFAULT 'draft',
  current_step public.verification_step NOT NULL DEFAULT 'personal',

  full_name text,
  cpf text,
  birth_date date,
  phone text,
  email text,

  identity_document_type text CHECK (identity_document_type IN ('rg','cnh')),
  identity_document_front_path text,
  identity_document_back_path text,

  selfie_path text,
  liveness_status public.liveness_status NOT NULL DEFAULT 'not_started',

  address text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  address_proof_path text,

  professional_category uuid REFERENCES public.categories(id),
  services uuid[] NOT NULL DEFAULT '{}',
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0 AND experience_years <= 70),
  professional_description text,
  service_region text,
  service_radius integer NOT NULL DEFAULT 10 CHECK (service_radius > 0 AND service_radius <= 200),
  availability text,
  work_photos text[] NOT NULL DEFAULT '{}',

  verification_phone boolean NOT NULL DEFAULT false,
  verification_email boolean NOT NULL DEFAULT false,
  stripe_account_id text,
  stripe_verification_status text,

  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,

  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  submitted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.provider_verifications TO authenticated;
GRANT ALL ON public.provider_verifications TO service_role;
ALTER TABLE public.provider_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification owner reads" ON public.provider_verifications
  FOR SELECT TO authenticated
  USING (
    provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "verification owner inserts" ON public.provider_verifications
  FOR INSERT TO authenticated
  WITH CHECK (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));

CREATE POLICY "verification owner updates" ON public.provider_verifications
  FOR UPDATE TO authenticated
  USING (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));

CREATE TRIGGER provider_verifications_updated_at
BEFORE UPDATE ON public.provider_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX provider_verifications_status_idx ON public.provider_verifications (status, submitted_at DESC);

-- ============ AUDITORIA ============
CREATE TABLE public.verification_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES public.provider_verifications(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  previous_status public.verification_status,
  new_status public.verification_status,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verification_audit_logs TO authenticated;
GRANT ALL ON public.verification_audit_logs TO service_role;
ALTER TABLE public.verification_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit logs readable by owner and admin" ON public.verification_audit_logs
  FOR SELECT TO authenticated
  USING (
    provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE INDEX verification_audit_logs_verification_idx ON public.verification_audit_logs (verification_id, created_at DESC);

-- ============ PROTEÇÃO DE CAMPOS ADMINISTRATIVOS ============
CREATE OR REPLACE FUNCTION public.protect_verification_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('fixnow.system_update', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.liveness_status := 'not_started';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.rejection_reason := NULL;
    NEW.stripe_verification_status := NULL;
    NEW.submitted_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
    RAISE EXCEPTION 'Verification ownership cannot be changed';
  END IF;
  IF OLD.status IN ('under_review','approved','suspended') THEN
    RAISE EXCEPTION 'Verification can no longer be edited';
  END IF;

  NEW.status := OLD.status;
  NEW.liveness_status := OLD.liveness_status;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.stripe_verification_status := OLD.stripe_verification_status;
  NEW.submitted_at := OLD.submitted_at;

  IF NEW.current_step = 'review' THEN
    NEW.current_step := OLD.current_step;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_verification_admin_fields
BEFORE INSERT OR UPDATE ON public.provider_verifications
FOR EACH ROW EXECUTE FUNCTION public.protect_verification_admin_fields();

-- ============ ENVIO PARA ANÁLISE ============
CREATE OR REPLACE FUNCTION public.submit_verification()
RETURNS public.provider_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
  v public.provider_verifications%rowtype;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT pv.* INTO v
  FROM public.provider_verifications pv
  JOIN public.providers p ON p.id = pv.provider_id
  WHERE p.user_id = actor;

  IF NOT FOUND THEN RAISE EXCEPTION 'Verification not found'; END IF;
  IF v.status IN ('under_review','approved','suspended') THEN RETURN v; END IF;

  IF coalesce(trim(v.full_name), '') = '' OR v.cpf IS NULL OR v.birth_date IS NULL
     OR coalesce(trim(v.phone), '') = '' OR coalesce(trim(v.email), '') = '' THEN
    RAISE EXCEPTION 'Complete os dados pessoais antes de enviar';
  END IF;
  IF v.identity_document_type IS NULL OR v.identity_document_front_path IS NULL
     OR v.identity_document_back_path IS NULL THEN
    RAISE EXCEPTION 'Envie a frente e o verso do documento';
  END IF;
  IF v.selfie_path IS NULL THEN RAISE EXCEPTION 'Envie a selfie com o documento'; END IF;
  IF coalesce(trim(v.address), '') = '' OR coalesce(trim(v.city), '') = ''
     OR coalesce(trim(v.zip_code), '') = '' OR v.address_proof_path IS NULL THEN
    RAISE EXCEPTION 'Complete o endereço e envie o comprovante';
  END IF;
  IF v.professional_category IS NULL OR coalesce(trim(v.professional_description), '') = ''
     OR coalesce(trim(v.service_region), '') = '' THEN
    RAISE EXCEPTION 'Complete os dados profissionais';
  END IF;
  IF v.terms_accepted_at IS NULL OR v.privacy_accepted_at IS NULL THEN
    RAISE EXCEPTION 'É necessário aceitar os Termos de Uso e a Política de Privacidade';
  END IF;

  PERFORM set_config('fixnow.system_update', 'on', true);
  UPDATE public.provider_verifications
     SET status = 'under_review', current_step = 'review', submitted_at = now(),
         rejection_reason = NULL, updated_at = now()
   WHERE id = v.id
  RETURNING * INTO v;
  PERFORM set_config('fixnow.system_update', '', true);

  INSERT INTO public.verification_audit_logs (verification_id, provider_id, actor_id, action, previous_status, new_status)
  VALUES (v.id, v.provider_id, actor, 'submitted', 'pending', 'under_review');

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_verification() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_verification() TO authenticated;

-- ============ ANÁLISE ADMINISTRATIVA ============
CREATE OR REPLACE FUNCTION public.review_verification(p_verification_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS public.provider_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
  v public.provider_verifications%rowtype;
  next_status public.verification_status;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an administrator can review verifications';
  END IF;

  SELECT * INTO v FROM public.provider_verifications WHERE id = p_verification_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification not found'; END IF;

  next_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'suspend' THEN 'suspended'
    ELSE NULL END::public.verification_status;

  IF next_status IS NULL THEN RAISE EXCEPTION 'Invalid review action'; END IF;
  IF next_status IN ('rejected','suspended') AND coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo';
  END IF;

  PERFORM set_config('fixnow.system_update', 'on', true);

  UPDATE public.provider_verifications
     SET status = next_status,
         reviewed_by = actor,
         reviewed_at = now(),
         rejection_reason = CASE WHEN next_status = 'approved' THEN NULL ELSE trim(p_reason) END,
         current_step = CASE WHEN next_status = 'rejected' THEN 'personal'::public.verification_step ELSE 'review'::public.verification_step END,
         updated_at = now()
   WHERE id = v.id
  RETURNING * INTO v;

  UPDATE public.providers
     SET approved = (next_status = 'approved'),
         verified = (next_status = 'approved')
   WHERE id = v.provider_id;

  PERFORM set_config('fixnow.system_update', '', true);

  INSERT INTO public.verification_audit_logs (verification_id, provider_id, actor_id, action, previous_status, new_status, reason)
  VALUES (v.id, v.provider_id, actor, p_action, v.status, next_status, nullif(trim(coalesce(p_reason, '')), ''));

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT p.user_id,
         CASE next_status WHEN 'approved' THEN 'Cadastro aprovado!'
                          WHEN 'rejected' THEN 'Cadastro recusado'
                          ELSE 'Cadastro suspenso' END,
         CASE WHEN next_status = 'approved' THEN 'Você já pode receber solicitações no FixNow.'
              ELSE coalesce(trim(p_reason), '') END,
         '/provider/verification'
  FROM public.providers p WHERE p.id = v.provider_id AND p.user_id IS NOT NULL;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.review_verification(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid, text, text) TO authenticated;

-- ============ ELEGIBILIDADE NO MARKETPLACE ============
CREATE OR REPLACE FUNCTION public.provider_is_verified(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.provider_verifications v
    WHERE v.provider_id = _provider_id
      AND v.status <> 'approved'
  );
$$;

-- Matching passa a exigir prestador elegível (verificação aprovada ou legado sem verificação)
CREATE OR REPLACE FUNCTION public.create_request_with_matching(p_request_id uuid, p_description text, p_when_option text, p_address text, p_service_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_need text DEFAULT NULL::text, p_photos text[] DEFAULT '{}'::text[], p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_city text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND public.provider_is_verified(pr.id)
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
$function$;

-- ============ STORAGE POLICIES (bucket verification-documents) ============
CREATE POLICY "verification docs owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.providers WHERE user_id = auth.uid())
  );

CREATE POLICY "verification docs owner select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] IN (SELECT id::text FROM public.providers WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

CREATE POLICY "verification docs owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] IN (SELECT id::text FROM public.providers WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );