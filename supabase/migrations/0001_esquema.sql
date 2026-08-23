-- FitFood — esquema base.
--
-- Multiusuario desde el día 1 aunque solo exista una cuenta: cada tabla lleva
-- user_id y RLS (ver 0002_rls.sql). Retrofitear el aislamiento después es donde
-- se filtran los datos de salud, así que se paga ahora.
--
-- La forma de las tablas conserva la de los JSON de la bitácora (momento,
-- confianza, origen, nota_correccion, porcion_ml para bebidas) para que la
-- importación sea una traducción directa y no una pérdida.

-- Marca de tiempo automática en actualizaciones.
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------- perfil ---

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  edad integer check (edad between 10 and 120),
  sexo text check (sexo in ('hombre', 'mujer')),
  estatura_cm numeric(5,1) check (estatura_cm between 100 and 250),
  fecha_dia_1 date,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger profiles_actualizado_en
  before update on public.profiles
  for each row execute function public.tocar_actualizado_en();

-- Al registrarse, la fila de perfil existe de una: el resto del código nunca
-- tiene que preguntarse si hay perfil o no.
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();


-- --------------------------------------------------------------- objetivo ---

-- Se guarda el histórico: cada ajuste semanal crea una fila nueva y desactiva
-- la anterior. Así se puede reconstruir con qué objetivo se vivió cada día.
create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  objetivo text not null default 'perder_grasa'
    check (objetivo in ('perder_grasa', 'mantener', 'ganar_musculo')),
  peso_meta_kg numeric(5,2),
  factor_actividad numeric(4,2) not null check (factor_actividad between 1.0 and 2.5),
  deficit_pct numeric(4,1) not null check (deficit_pct between -30 and 40),
  kcal integer not null check (kcal > 0),
  proteina_g integer not null check (proteina_g >= 0),
  carbs_g integer not null check (carbs_g >= 0),
  grasa_g integer not null check (grasa_g >= 0),
  activo boolean not null default true,
  motivo text,
  creado_en timestamptz not null default now()
);

-- Un solo objetivo activo por persona.
create unique index user_goals_uno_activo
  on public.user_goals (user_id) where activo;
create index user_goals_user_creado on public.user_goals (user_id, creado_en desc);


-- ------------------------------------------------------- tabla de alimentos ---

-- Semilla: los 133 alimentos de fitfood/data/tabla_alimentos.json.
-- El slug es lo que la IA emite para referirse a un alimento: es corto (barato
-- en tokens) y estable, a diferencia de un uuid o del nombre completo.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  categoria text not null,
  kcal100 numeric(7,2) not null check (kcal100 >= 0),
  p100 numeric(6,2) not null check (p100 >= 0),
  c100 numeric(6,2) not null check (c100 >= 0),
  g100 numeric(6,2) not null check (g100 >= 0),
  porcion_g numeric(7,2) check (porcion_g > 0),
  porcion_nota text,
  -- Las filas semilla son públicas y de solo lectura; las que crea cada
  -- persona quedan privadas (ver políticas en 0002_rls.sql).
  publico boolean not null default false,
  creado_por uuid references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint foods_publico_sin_dueno
    check ((publico and creado_por is null) or (not publico and creado_por is not null))
);

create trigger foods_actualizado_en
  before update on public.foods
  for each row execute function public.tocar_actualizado_en();

create index foods_creado_por on public.foods (creado_por) where creado_por is not null;
create index foods_categoria on public.foods (categoria);

-- Sin índice de texto completo a propósito. La tabla son ~133 filas: el
-- buscador de F2 las trae una vez y filtra en el cliente (sin ida y vuelta
-- por tecleo), y el prompt de la IA necesita la tabla entera de todos modos.
-- Un índice GIN sobre unaccent() además obligaría a un envoltorio IMMUTABLE y
-- a asumir en qué schema quedó la extensión, que difiere entre Supabase y un
-- Postgres normal. Si algún día la tabla crece de verdad, ese es el momento.


-- ---------------------------------------------------- sesiones de registro ---

-- Una sesión = una conversación corta para registrar una comida.
-- Los contadores viven acá porque los guardrails se verifican en Postgres,
-- nunca en el cliente.
create table public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  foto_path text,
  estado text not null default 'abierta'
    check (estado in ('abierta', 'guardada', 'descartada')),
  turnos integer not null default 0 check (turnos >= 0),
  fuera_de_tema_count integer not null default 0 check (fuera_de_tema_count >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger scan_sessions_actualizado_en
  before update on public.scan_sessions
  for each row execute function public.tocar_actualizado_en();

create index scan_sessions_user_creado on public.scan_sessions (user_id, creado_en desc);

-- Un turno = una llamada a la API. Se guarda crudo para poder medir precisión
-- después, y con tokens y costo para que el gasto sea un número visible y no
-- una sorpresa a fin de mes.
create table public.scan_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.scan_sessions(id) on delete cascade,
  -- Denormalizado a propósito: permite políticas RLS sin subconsulta por fila.
  user_id uuid not null references auth.users(id) on delete cascade,
  indice integer not null check (indice >= 0),
  entrada_texto text,
  tuvo_foto boolean not null default false,
  respuesta_ia_json jsonb,
  fuera_de_tema boolean not null default false,
  latencia_ms integer check (latencia_ms >= 0),
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_cache_read integer not null default 0 check (tokens_cache_read >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  -- Se congela el costo al momento de la llamada: si mañana cambia el precio
  -- del modelo, el histórico de gasto no se reescribe solo.
  costo_usd numeric(10,6) not null default 0 check (costo_usd >= 0),
  modelo text,
  creado_en timestamptz not null default now(),
  unique (session_id, indice)
);

create index scan_turns_user_creado on public.scan_turns (user_id, creado_en desc);


-- ------------------------------------------------------- diario de comidas ---

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  -- Los momentos salen de los que la bitácora usa de verdad. "snack tarde" se
  -- normaliza a "snack" en la importación: la hora del día ya vive en `hora`.
  momento text not null
    check (momento in ('desayuno', 'almuerzo', 'cena', 'snack', 'postre',
                       'bebida', 'otro')),
  hora time,
  confianza text check (confianza in ('alta', 'media', 'baja')),
  origen text not null default 'manual'
    check (origen in ('foto', 'descripcion', 'foto+descripcion', 'manual')),
  -- Si la estimación se afinó en la conversación o a mano en la tarjeta.
  corregido boolean not null default false,
  nota text,
  scan_session_id uuid references public.scan_sessions(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger meal_logs_actualizado_en
  before update on public.meal_logs
  for each row execute function public.tocar_actualizado_en();

create index meal_logs_user_fecha on public.meal_logs (user_id, fecha desc);

create table public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references public.meal_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null cuando el alimento no está en la tabla (texto libre de la IA).
  food_id uuid references public.foods(id) on delete set null,
  alimento text not null,
  porcion_g numeric(7,2) check (porcion_g > 0),
  porcion_ml numeric(7,2) check (porcion_ml > 0),
  kcal numeric(7,2) not null check (kcal >= 0),
  proteina_g numeric(6,2) not null default 0 check (proteina_g >= 0),
  carbs_g numeric(6,2) not null default 0 check (carbs_g >= 0),
  grasa_g numeric(6,2) not null default 0 check (grasa_g >= 0),
  nota_correccion text,
  -- Notas del ítem que no son correcciones (de dónde salió la porción, cómo
  -- estaba preparado). En la bitácora aparecen como nota, nota_porcion y
  -- porcion_nota; acá viven en un solo campo.
  nota text,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  -- Gramos o mililitros, nunca ambos. Puede no haber ninguno: hay ítems donde
  -- la cantidad va en el nombre ("3 huevos") y otros donde no significa nada
  -- ("agua", "café con endulzante"). En la bitácora eso pasa en 19 de 147
  -- ítems, así que exigir una porción siempre sería exigirle a los datos algo
  -- que no cumplen.
  constraint meal_log_items_porcion_coherente
    check (num_nonnulls(porcion_g, porcion_ml) <= 1)
);

create index meal_log_items_meal_log on public.meal_log_items (meal_log_id, orden);
create index meal_log_items_food on public.meal_log_items (food_id) where food_id is not null;


-- ------------------------------------------------------------------- peso ---

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  peso_kg numeric(5,2) not null check (peso_kg between 20 and 400),
  condiciones text,
  nota text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- Un peso por día: el segundo pesaje corrige al primero, no se suma.
  unique (user_id, fecha)
);

create trigger weight_logs_actualizado_en
  before update on public.weight_logs
  for each row execute function public.tocar_actualizado_en();

create index weight_logs_user_fecha on public.weight_logs (user_id, fecha desc);
