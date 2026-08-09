insert into storage.buckets (id, name, public) values ('service-request-photos', 'service-request-photos', false) on conflict (id) do update set public = false;

create policy "Users can upload their own request photos" on storage.objects for insert to authenticated
with check (bucket_id = 'service-request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Request participants can view request photos" on storage.objects for select to authenticated
using (bucket_id = 'service-request-photos' and ((storage.foldername(name))[1] = auth.uid()::text or exists (select 1 from public.service_requests sr join public.providers p on p.id = sr.provider_id where sr.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid())));

create policy "Users can delete their own request photos" on storage.objects for delete to authenticated
using (bucket_id = 'service-request-photos' and (storage.foldername(name))[1] = auth.uid()::text);
