-- ═══════════════════════════════════════════════════════════════════════
--  FitFood — 06 · Las dos medidas de cintura de la bitácora
--
--  Corré primero 05-cintura.sql. Después pegá esto y dale Run.
--  Se puede correr dos veces sin romper nada.
--
--  Trae a la app lo que ya estaba en fitfood/data/medidas.json:
--
--      11 ago  95 cm   linea base del intake
--      23 ago  93 cm   dia 12, primera remedicion
--
--  Sin esto, la primera cintura que guardes en la app se lee como "primera
--  medida" y no compara nada, teniendo dos puntos anteriores.
--
--  Al terminar tiene que decir:  ✓ listo  ·  medidas 2  ·  primera 2026-08-11
-- ═══════════════════════════════════════════════════════════════════════

-- ⚠️ El correo aparece DOS veces en este archivo, marcadas con «CORREO».
-- Revisá las dos. Si hay más de una cuenta en el proyecto, eso es lo único
-- que evita escribirle las medidas a la persona equivocada: el SQL Editor
-- corre como administrador y el RLS no lo frena.

do $$
declare
  duenio uuid;
  faltantes text;
  escritas integer;
begin
  -- CORREO (1 de 2)
  select id into duenio from auth.users
    where email = 'jander626@gmail.com';

  if duenio is null then
    raise exception
      'No hay ninguna cuenta con ese correo. Revisá las dos líneas marcadas CORREO.';
  end if;

  -- Las medidas van sobre el pesaje del mismo día: peso y cintura son la
  -- misma medición de la misma mañana. Si el pesaje no está, no hay fila
  -- donde escribirla.
  select string_agg(v.fecha::text, ', ') into faltantes
  from (values ('2026-08-11'::date), ('2026-08-23'::date)) as v(fecha)
  where not exists (
    select 1 from public.weight_logs w
    where w.user_id = duenio and w.fecha = v.fecha
  );

  if faltantes is not null then
    raise exception
      'Faltan los pesajes del %. ¿Corriste la importación de la bitácora?',
      faltantes;
  end if;

  update public.weight_logs w
  set cintura_cm = v.cintura
  from (values
    ('2026-08-11'::date, 95.0),
    ('2026-08-23'::date, 93.0)
  ) as v(fecha, cintura)
  where w.fecha = v.fecha
    and w.user_id = duenio
    -- Sin esto, volver a correr el archivo pisaría una corrección hecha a
    -- mano en la app. Lo que escribiste vos manda sobre lo que dice la
    -- bitácora, siempre.
    and w.cintura_cm is null;

  get diagnostics escritas = row_count;
  raise log 'cinturas escritas: %', escritas;
end $$;


-- ------------------------------------------------------------ confirmar ---
-- CORREO (2 de 2)
select
  '✓ listo' as resultado,
  count(*) filter (where cintura_cm is not null) as medidas,
  min(fecha) filter (where cintura_cm is not null) as primera,
  max(fecha) filter (where cintura_cm is not null) as ultima
from public.weight_logs
where user_id = (
  select id from auth.users where email = 'jander626@gmail.com'
);
