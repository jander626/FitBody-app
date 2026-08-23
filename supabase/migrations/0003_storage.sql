-- FitFood — almacenamiento de las fotos de comida.
--
-- Bucket privado. Las fotos solo se sirven por URL firmada y de corta
-- duración; nunca son públicas.
--
-- Convención de rutas: {user_id}/{scan_session_id}.jpg
-- El primer segmento es el dueño, y de ahí cuelgan las políticas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comidas',
  'comidas',
  false,
  5 * 1024 * 1024,                          -- el cliente comprime a ~1024px
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "fotos propias: leer" on storage.objects
  for select using (
    bucket_id = 'comidas'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "fotos propias: subir" on storage.objects
  for insert with check (
    bucket_id = 'comidas'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "fotos propias: borrar" on storage.objects
  for delete using (
    bucket_id = 'comidas'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
