REVOKE ALL ON FUNCTION public.is_request_client(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_invited_provider(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.unaccent_stub(text) FROM public, anon;