REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid, text) TO service_role;