-- ═══════════════════════════════════════════════════════════════════════
--  FitFood — 03 · Métricas diarias del reloj
--
--  Pegá TODO esto en el SQL Editor de Supabase y dale Run.
--  Se puede correr dos veces sin romper nada.
--
--  Al terminar tiene que decir:  ✓ listo: tabla daily_metrics creada
-- ═══════════════════════════════════════════════════════════════════════

-- Si el esquema base no está, mejor decirlo claro que fallar con un error
-- de Postgres que no explica nada.
do $$
begin
  if to_regproc('public.tocar_actualizado_en') is null then
    raise exception using message =
      'Falta el esquema base. Corré primero las migraciones 0001 y 0002 '
      'antes de esta.';
  end if;
end $$;


-- ------------------------------------------------------------- la tabla ---
-- Una fila por día y por persona, con lo que Garmin exporta.
--
-- Todas las columnas son opcionales a propósito: los informes salen por
-- separado y con rangos distintos, así que un día con pasos y sin sueño es
-- normal, y la importación completa la fila cuando llega el otro archivo.

create table if not exists public.daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,

  pasos integer check (pasos between 0 and 200000),
  pasos_objetivo integer check (pasos_objetivo between 0 and 200000),

  sueno_horas numeric(4,2) check (sueno_horas between 0 and 24),
  sueno_calidad text,
  sueno_puntuacion integer check (sueno_puntuacion between 0 and 100),
  fc_reposo integer check (fc_reposo between 20 and 200),
  body_battery integer check (body_battery between 0 and 100),

  -- El gasto que mide el reloj. Cuando está, manda sobre la fórmula.
  kcal_activas integer check (kcal_activas between 0 and 10000),
  kcal_totales integer check (kcal_totales between 0 and 20000),

  fuente text not null default 'garmin_csv',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Un día es un día: reimportar un archivo que se solapa con otro actualiza
  -- la fila en vez de duplicarla. Los rangos exportados se pisan siempre.
  primary key (user_id, fecha)
);

drop trigger if exists daily_metrics_actualizado_en on public.daily_metrics;
create trigger daily_metrics_actualizado_en
  before update on public.daily_metrics
  for each row execute function public.tocar_actualizado_en();

-- El historial lee rangos de fechas hacia atrás.
create index if not exists daily_metrics_fecha
  on public.daily_metrics (user_id, fecha desc);


-- ----------------------------------------------------------------- RLS ---
-- La regla de siempre: cada quien ve y escribe solo sus filas.

alter table public.daily_metrics enable row level security;

drop policy if exists "métricas propias" on public.daily_metrics;
create policy "métricas propias" on public.daily_metrics
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- ------------------------------------------------------------ confirmar ---
-- Si algo quedó mal, corta acá con una excepción. Es preferible un error a
-- dejar datos de salud abiertos creyendo que salió bien.
do $$
declare
  con_rls boolean;
  politicas integer;
begin
  select relrowsecurity into con_rls
    from pg_class where oid = 'public.daily_metrics'::regclass;

  select count(*) into politicas
    from pg_policies
    where schemaname = 'public' and tablename = 'daily_metrics';

  if not con_rls or politicas = 0 then
    raise exception 'La tabla quedó sin RLS. No sigas: tus datos quedarían abiertos.';
  end if;
end $$;

-- El resultado va como SELECT, no como `raise notice`: el SQL Editor de
-- Supabase muestra filas, no avisos. Con un notice la pantalla dice
-- "Success. No rows returned" y uno se queda sin saber si funcionó.
select
  '✓ listo: tabla daily_metrics creada' as resultado,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'daily_metrics') as politicas_rls,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'daily_metrics') as columnas;
