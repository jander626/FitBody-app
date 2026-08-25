-- ═══════════════════════════════════════════════════════════════════════
--  FitFood — 04 · Almacenamiento de las fotos de comida
--
--  Pegá TODO esto en el SQL Editor de Supabase y dale Run.
--  Se puede correr dos veces sin romper nada.
--
--  Sin esto, cada foto que mandes se pierde: la comida se registra y se
--  estima bien, pero la imagen no se guarda en ningún lado.
--
--  Al terminar tiene que decir:  ✓ listo: bucket comidas, con 3 política(s)
-- ═══════════════════════════════════════════════════════════════════════

-- Bucket privado. Las fotos solo se sirven por URL firmada y de corta
-- duración; nunca son públicas.
--
-- Convención de rutas: {user_id}/{uuid}.jpg
-- El primer segmento es el dueño, y de ahí cuelgan las políticas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comidas',
  'comidas',
  false,
  5 * 1024 * 1024,                          -- el cliente comprime a ~1024px
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ----------------------------------------------------------------- RLS ---
-- Cada quien ve, sube y borra solo lo que cuelga de su propia carpeta.

drop policy if exists "fotos propias: leer" on storage.objects;
create policy "fotos propias: leer" on storage.objects
  for select using (
    bucket_id = 'comidas'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "fotos propias: subir" on storage.objects;
create policy "fotos propias: subir" on storage.objects
  for insert with check (
    bucket_id = 'comidas'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "fotos propias: borrar" on storage.objects;
create policy "fotos propias: borrar" on storage.objects
  for delete using (
    bucket_id = 'comidas'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );


-- ------------------------------------------------------------ confirmar ---
do $$
declare
  publico boolean;
  politicas integer;
begin
  select public into publico from storage.buckets where id = 'comidas';

  if publico is null then
    raise exception 'El bucket no se creó. Revisá si tu proyecto tiene Storage habilitado.';
  end if;

  -- Un bucket público serviría las fotos de comida a cualquiera que adivine
  -- la URL. Vale más cortar acá que enterarse después.
  if publico then
    raise exception 'El bucket quedó PÚBLICO. No sigas: tus fotos serían visibles para cualquiera.';
  end if;

  select count(*) into politicas
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'fotos propias%';

  if politicas < 3 then
    raise exception 'Faltan políticas de acceso (hay %). Sin las tres, subir o ver fotos falla.', politicas;
  end if;
end $$;

select
  '✓ listo: bucket comidas' as resultado,
  (select case when public then 'PÚBLICO (mal)' else 'privado' end
     from storage.buckets where id = 'comidas') as visibilidad,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'fotos propias%') as politicas;
