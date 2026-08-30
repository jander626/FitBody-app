-- ═══════════════════════════════════════════════════════════════════════
--  FitFood — 05 · Medida de cintura
--
--  Pegá TODO esto en el SQL Editor de Supabase y dale Run.
--  Se puede correr dos veces sin romper nada.
--
--  Sin esto, la pantalla de Peso muestra el campo de cintura pero al guardar
--  falla: la columna no existe.
--
--  Al terminar tiene que decir:  ✓ listo: columna cintura_cm
-- ═══════════════════════════════════════════════════════════════════════

-- La cintura va en weight_logs y no en una tabla aparte porque es la misma
-- medición del mismo momento: uno se pesa y se mide de una, en ayunas y antes
-- de desayunar. Separarlas obligaría a cruzar dos tablas por fecha para
-- responder la única pregunta que importa —¿el peso que bajó era grasa?— y a
-- mantener dos juegos de políticas RLS para el mismo dato.
--
-- Es nullable a propósito: el peso se toma todos los días y la cintura una vez
-- por semana. La mayoría de las filas van a tener peso y no cintura, y eso
-- está bien.

alter table public.weight_logs
  add column if not exists cintura_cm numeric(4,1);

-- Rango amplio a propósito: esto es una red contra el dedo pegado en el
-- teclado (940 en vez de 94), no una opinión sobre qué cintura es normal.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.weight_logs'::regclass
      and conname = 'weight_logs_cintura_cm_check'
  ) then
    alter table public.weight_logs
      add constraint weight_logs_cintura_cm_check
      check (cintura_cm is null or cintura_cm between 40 and 250);
  end if;
end $$;

comment on column public.weight_logs.cintura_cm is
  'Perímetro abdominal en cm, a la altura del ombligo. Semanal, no diario.';


-- ------------------------------------------------------------ confirmar ---
do $$
declare
  tipo text;
begin
  select data_type into tipo
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'weight_logs'
      and column_name = 'cintura_cm';

  if tipo is null then
    raise exception 'La columna cintura_cm no se creó. ¿Corriste antes las migraciones 0001 y 0002?';
  end if;

  -- Sin el check, un 940 mal tecleado entra y descuadra la lectura por meses.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.weight_logs'::regclass
      and conname = 'weight_logs_cintura_cm_check'
  ) then
    raise exception 'Falta la restricción de rango de cintura_cm.';
  end if;
end $$;

select
  '✓ listo: columna cintura_cm' as resultado,
  (select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'weight_logs'
       and column_name = 'cintura_cm') as tipo,
  (select count(*) from public.weight_logs where cintura_cm is not null)
    as medidas_guardadas;
