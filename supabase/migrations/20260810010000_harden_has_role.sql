-- Harden has_role RPC exposure.
-- The public schema functions were callable through PostgREST as SECURITY DEFINER.
-- Keep the privileged implementation in a non-exposed schema and use it from RLS policies.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(public.app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(public.app_role, uuid) TO authenticated;

ALTER POLICY "admin manages categories" ON public.categories USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "admin reads profiles" ON public.profiles USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "admin updates profiles" ON public.profiles USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "admin inserts providers" ON public.providers WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "admin updates providers" ON public.providers USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "quotes read by parties" ON public.quotes USING ((provider_id IN (SELECT providers.id FROM providers WHERE providers.user_id = auth.uid())) OR (request_id IN (SELECT service_requests.id FROM service_requests WHERE service_requests.client_id = auth.uid())) OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "admin deletes reviews" ON public.reviews USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "client reads own requests" ON public.service_requests USING ((auth.uid() = client_id) OR private.has_role(auth.uid(), 'admin'::public.app_role) OR (provider_id IN (SELECT providers.id FROM providers WHERE providers.user_id = auth.uid())));
ALTER POLICY "admin manages services" ON public.services USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins manage roles" ON public.user_roles USING ((SELECT private.has_role('admin'::public.app_role, auth.uid()))) WITH CHECK ((SELECT private.has_role('admin'::public.app_role, auth.uid())));
ALTER POLICY "Users can view own role" ON public.user_roles USING (((SELECT auth.uid() AS uid) = user_id) OR (SELECT private.has_role('admin'::public.app_role, auth.uid())));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_role(public.app_role, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(public.app_role, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(public.app_role, uuid) FROM authenticated;
