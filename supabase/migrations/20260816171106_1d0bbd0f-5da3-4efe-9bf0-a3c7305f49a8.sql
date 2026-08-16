revoke all on function public.accept_quote(uuid) from public, anon;
revoke all on function public.submit_review(uuid, integer, integer, integer, integer, text, text) from public, anon;
grant execute on function public.accept_quote(uuid) to authenticated;
grant execute on function public.submit_review(uuid, integer, integer, integer, integer, text, text) to authenticated;