ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS dest_lat double precision,
  ADD COLUMN IF NOT EXISTS dest_lng double precision;

CREATE TABLE public.request_locations (
  request_id uuid PRIMARY KEY REFERENCES public.service_requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_locations TO authenticated;
GRANT ALL ON public.request_locations TO service_role;

ALTER TABLE public.request_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location read by parties"
ON public.request_locations FOR SELECT TO authenticated
USING (
  request_id IN (
    SELECT sr.id FROM public.service_requests sr
    WHERE sr.client_id = auth.uid()
       OR sr.provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "location insert by provider"
ON public.request_locations FOR INSERT TO authenticated
WITH CHECK (
  provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid())
  AND request_id IN (SELECT sr.id FROM public.service_requests sr WHERE sr.provider_id = provider_id)
);

CREATE POLICY "location update by provider"
ON public.request_locations FOR UPDATE TO authenticated
USING (provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid()))
WITH CHECK (provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid()));

CREATE POLICY "location delete by provider"
ON public.request_locations FOR DELETE TO authenticated
USING (provider_id IN (SELECT p.id FROM public.providers p WHERE p.user_id = auth.uid()));

CREATE TRIGGER set_request_locations_updated_at
BEFORE UPDATE ON public.request_locations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.request_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_locations;