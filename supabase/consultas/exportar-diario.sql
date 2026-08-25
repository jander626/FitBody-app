-- FitFood · exportar tu diario
--
-- Devuelve una fila por día, con el mismo formato JSON que usa la bitácora
-- (data/comidas/AAAA-MM-DD.json). Así lo que registres en la app puede volver
-- al repo, o guardarse como respaldo, sin depender de FitFood para leerlo.
--
-- Para bajarlo: pegá esto en el SQL Editor, Run, y el botón "Export" de arriba
-- a la derecha de los resultados te lo da en CSV.
--
-- Si querés un solo día, descomentá la línea del `where` al final.

with items as (
  select
    ml.id                as comida_id,
    ml.fecha,
    ml.momento,
    ml.confianza,
    ml.origen,
    ml.nota,
    ml.creado_en,
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'alimento',        i.alimento,
        'porcion_g',       i.porcion_g,
        'porcion_ml',      i.porcion_ml,
        'kcal',            i.kcal,
        'proteina_g',      i.proteina_g,
        'carbs_g',         i.carbs_g,
        'grasa_g',         i.grasa_g,
        'nota_correccion', i.nota_correccion,
        'nota',            i.nota
      ))
      order by i.orden
    ) as items,
    -- Los subtotales se calculan, no se guardan: uno almacenado se
    -- desincroniza en cuanto se edita un ítem.
    jsonb_build_object(
      'kcal',       round(sum(i.kcal)::numeric, 1),
      'proteina_g', round(sum(i.proteina_g)::numeric, 1),
      'carbs_g',    round(sum(i.carbs_g)::numeric, 1),
      'grasa_g',    round(sum(i.grasa_g)::numeric, 1)
    ) as subtotal
  from public.meal_logs ml
  join public.meal_log_items i on i.meal_log_id = ml.id
  where ml.user_id = auth.uid()
  group by ml.id
),
comidas as (
  select
    fecha,
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'momento',   momento,
        'items',     items,
        'subtotal',  subtotal,
        'confianza', confianza,
        'origen',    origen,
        'nota',      nota
      ))
      order by creado_en
    ) as comidas,
    jsonb_build_object(
      'kcal',       round(sum((subtotal->>'kcal')::numeric), 1),
      'proteina_g', round(sum((subtotal->>'proteina_g')::numeric), 1),
      'carbs_g',    round(sum((subtotal->>'carbs_g')::numeric), 1),
      'grasa_g',    round(sum((subtotal->>'grasa_g')::numeric), 1)
    ) as totales
  from items
  group by fecha
)
select
  c.fecha,
  jsonb_pretty(
    jsonb_strip_nulls(jsonb_build_object(
      'fecha',    c.fecha,
      -- Día 1 del plan, contado desde la fecha del perfil.
      'dia_plan', (c.fecha - p.fecha_dia_1) + 1,
      'peso_kg',  (select w.peso_kg from public.weight_logs w
                   where w.user_id = auth.uid() and w.fecha = c.fecha),
      'comidas',  c.comidas,
      'totales',  c.totales
    ))
  ) as json
from comidas c
cross join (
  select fecha_dia_1 from public.profiles where id = auth.uid()
) p
-- where c.fecha = '2026-08-24'
order by c.fecha;
