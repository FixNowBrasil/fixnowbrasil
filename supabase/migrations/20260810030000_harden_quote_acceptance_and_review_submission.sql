-- Make quote acceptance and review submission atomic.
-- Also enforce one accepted quote and one review per service request.

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_one_accepted_per_request
  ON public.quotes (request_id)
  WHERE status = 'accepted';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_one_per_request
  ON public.reviews (request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.accept_quote(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  q public.quotes%ROWTYPE;
  r public.service_requests%ROWTYPE;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT sr.*
    INTO r
  FROM public.service_requests sr
  WHERE sr.id = (SELECT request_id FROM public.quotes WHERE id = p_quote_id)
  FOR UPDATE;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Service request not found';
  END IF;

  IF r.client_id <> actor THEN
    RAISE EXCEPTION 'Only the request owner can accept a quote';
  END IF;

  IF r.status <> 'analyzing' THEN
    RAISE EXCEPTION 'Request must be under analysis before accepting a quote';
  END IF;

  SELECT * INTO q
  FROM public.quotes
  WHERE id = p_quote_id
    AND request_id = r.id
  FOR UPDATE;

  IF q.id IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF q.status NOT IN ('pending', 'sent') THEN
    RAISE EXCEPTION 'Only an open quote can be accepted';
  END IF;

  UPDATE public.quotes
  SET status = 'rejected', updated_at = now()
  WHERE request_id = r.id
    AND id <> q.id
    AND status IN ('pending', 'sent');

  UPDATE public.quotes
  SET status = 'accepted', updated_at = now()
  WHERE id = q.id;

  UPDATE public.service_requests
  SET status = 'confirmed',
      price_estimate = q.amount,
      updated_at = now()
  WHERE id = r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_quote(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_review(
  p_request_id uuid,
  p_rating integer,
  p_punctuality integer,
  p_quality integer,
  p_service integer,
  p_comment text,
  p_author_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  r public.service_requests%ROWTYPE;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO r
  FROM public.service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Service request not found';
  END IF;

  IF r.client_id <> actor THEN
    RAISE EXCEPTION 'Only the request owner can submit a review';
  END IF;

  IF r.provider_id IS NULL OR r.status <> 'completed' THEN
    RAISE EXCEPTION 'A review can only be submitted after the service is completed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE request_id = r.id) THEN
    RAISE EXCEPTION 'This service has already been reviewed';
  END IF;

  IF p_rating NOT BETWEEN 1 AND 5
     OR p_punctuality NOT BETWEEN 1 AND 5
     OR p_quality NOT BETWEEN 1 AND 5
     OR p_service NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Review scores must be between 1 and 5';
  END IF;

  INSERT INTO public.reviews (
    provider_id, request_id, client_id, author_name,
    rating, punctuality, quality, service, comment
  ) VALUES (
    r.provider_id, r.id, actor, COALESCE(NULLIF(trim(p_author_name), ''), 'Cliente FixNow'),
    p_rating, p_punctuality, p_quality, p_service, NULLIF(trim(p_comment), '')
  );

  UPDATE public.service_requests
  SET status = 'rated', updated_at = now()
  WHERE id = r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review(uuid, integer, integer, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, integer, integer, integer, text, text) TO authenticated;
