-- La cintura vive en weight_logs. La app la usa (pantalla de Peso, consejos),
-- pero la columna solo existia como consulta suelta (consultas/05-cintura.sql):
-- un proyecto de Supabase nuevo, armado solo con las migraciones, fallaba al
-- guardar un peso. Esta migracion la trae al esquema.
--
-- Idempotente: en el proyecto donde ya se corrio la consulta no cambia nada.

alter table public.weight_logs
  add column if not exists cintura_cm numeric(4,1);

-- Rango amplio a proposito: es una red contra el dedo pegado en el teclado
-- (940 en vez de 94), no una opinion sobre que cintura es normal.
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
