-- Real provider profile/work photos for FixNow.
-- Apply through Supabase/Lovable migration runner before using the new upload UI.

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('provider-work-photos', 'provider-work-photos', true)
on conflict (id) do update set public = excluded.public;

create policy "provider can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "provider can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "provider can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "provider can upload own work photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'provider-work-photos'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "provider can update own work photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'provider-work-photos'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'provider-work-photos'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "provider can delete own work photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'provider-work-photos'
  and exists (select 1 from public.providers p where p.user_id = auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
);
