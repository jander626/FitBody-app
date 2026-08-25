-- FitFood — métricas diarias del reloj.
--
-- Una fila por día y por persona, con lo que Garmin exporta: pasos, sueño,
-- frecuencia cardiaca en reposo, body battery y —cuando se exporta el informe
-- de calorías— el gasto real del día.
--
-- Todas las columnas son opcionales a propósito. Los informes de Garmin salen
-- por separado y con rangos de fechas distintos: el de pasos puede llegar
-- hasta el 23 y el de sueño hasta el 11. Un día con pasos y sin sueño es
-- normal, no un error, y la importación completa la fila cuando llega el otro
-- archivo.

create table public.daily_metrics (
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

create trigger daily_metrics_actualizado_en
  before update on public.daily_metrics
  for each row execute function public.tocar_actualizado_en();

-- El historial lee rangos de fechas hacia atrás.
create index daily_metrics_fecha on public.daily_metrics (user_id, fecha desc);


-- ------------------------------------------------------------------ RLS ---

alter table public.daily_metrics enable row level security;

create policy "métricas propias" on public.daily_metrics
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
