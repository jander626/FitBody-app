-- Stubs mínimos de lo que Supabase provee, para poder correr las migraciones
-- contra un Postgres limpio y verificar que el SQL es válido.
--
-- NO es una migración: no se aplica nunca al proyecto real. Solo lo usa
-- `scripts/verificar-migraciones.sh`.

create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- En Supabase esto lee el JWT de la petición. Acá lo simulamos con una
-- variable de sesión, lo que además permite probar el aislamiento entre
-- usuarios en `01_rls.sql`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;
