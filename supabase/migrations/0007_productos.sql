-- Productos empacados propios: la base que crece al escanear.
--
-- Open Food Facts es colaborativa y en Colombia tiene huecos. Cuando un
-- producto no esta (o esta sin su tabla nutricional), la persona le toma foto a
-- la etiqueta, se leen los valores y el producto queda guardado aqui con su
-- codigo de barras: la proxima vez que lo escanee sale al instante, sin red y
-- sin gastar una llamada de IA.
--
-- Son filas de `foods` privadas (cada persona ve las suyas, igual que el resto
-- de alimentos propios), asi que no hace falta una tabla nueva ni politicas
-- nuevas: las de 0002 ya cubren crear, leer, actualizar y borrar lo propio.

alter table public.foods
  add column if not exists codigo_barras text;

-- Un EAN/UPC tiene 8, 12, 13 o 14 digitos. Nada mas se guarda.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foods'::regclass
      and conname = 'foods_codigo_barras_check'
  ) then
    alter table public.foods
      add constraint foods_codigo_barras_check
      check (codigo_barras is null or codigo_barras ~ '^([0-9]{8}|[0-9]{12,14})$');
  end if;
end $$;

-- Un producto por codigo y por persona. Es una restriccion normal y no un
-- indice parcial a proposito: el upsert de la app necesita nombrarla en
-- `on conflict`, y PostgREST no puede escribir el `where` de un indice parcial.
-- Las filas sin codigo (todo lo demas) no chocan entre si: NULL no es igual a NULL.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.foods'::regclass
      and conname = 'foods_codigo_por_dueno'
  ) then
    alter table public.foods
      add constraint foods_codigo_por_dueno unique (creado_por, codigo_barras);
  end if;
end $$;

create index if not exists foods_codigo_barras
  on public.foods (codigo_barras) where codigo_barras is not null;


-- Lecturas de etiqueta con IA: un registro por foto leida.
--
-- Existe para poner un techo al gasto, igual que `scan_sessions` lo hace con las
-- estimaciones de comida: sin contador, cualquiera podria leer mil etiquetas.
-- La ruta cuenta las del dia antes de llamar al modelo.
create table if not exists public.label_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modelo text,
  costo_usd numeric(10,6) not null default 0 check (costo_usd >= 0),
  creado_en timestamptz not null default now()
);

create index if not exists label_scans_user_creado
  on public.label_scans (user_id, creado_en desc);

alter table public.label_scans enable row level security;

-- Solo se leen y se crean las propias. No se actualizan ni se borran desde la
-- app: es un libro de cuentas, no un dato editable.
drop policy if exists "lecturas de etiqueta propias: leer" on public.label_scans;
create policy "lecturas de etiqueta propias: leer" on public.label_scans
  for select using ((select auth.uid()) = user_id);

drop policy if exists "lecturas de etiqueta propias: crear" on public.label_scans;
create policy "lecturas de etiqueta propias: crear" on public.label_scans
  for insert with check ((select auth.uid()) = user_id);
