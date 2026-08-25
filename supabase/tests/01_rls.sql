-- Prueba de aislamiento entre usuarios.
--
-- El punto de RLS es que nadie vea los datos de otro. Eso hay que
-- demostrarlo, no suponerlo: cada `assert` de acá abajo es una fuga de datos
-- de salud que no ocurrió.
--
-- Se corre como un rol sin privilegios porque los superusuarios saltan RLS.

\set ON_ERROR_STOP on

-- Rol de aplicación, equivalente a `authenticated` en Supabase.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end;
$$;

grant usage on schema public, storage to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant select, insert, update, delete on storage.objects to app_user;

-- Dos personas y un alimento público, creados como superusuario (saltando RLS
-- a propósito: esto simula la semilla y el registro de cuentas).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'beto@example.com');

-- No se insertan perfiles a mano: el trigger de auth.users ya los creó.
-- Que esto pase es la prueba de que el trigger funciona.
do $$
declare n integer;
begin
  select count(*) into n from public.profiles;
  assert n = 2, format('El trigger deberia haber creado 2 perfiles, hay %s', n);
end;
$$;

insert into public.foods (slug, nombre, categoria, kcal100, p100, c100, g100, publico)
values ('arepa-media-tela', 'Arepa de maiz (media tela)', 'Carbohidrato / tuberculo',
        200, 4, 42, 2, true);

insert into public.weight_logs (user_id, fecha, peso_kg) values
  ('11111111-1111-1111-1111-111111111111', '2026-08-23', 78.9),
  ('22222222-2222-2222-2222-222222222222', '2026-08-23', 91.4);

-- Métricas del reloj: sueño, pasos y frecuencia cardiaca son datos de salud,
-- así que el aislamiento acá importa tanto como en el peso.
insert into public.daily_metrics (user_id, fecha, pasos, fc_reposo, kcal_totales) values
  ('11111111-1111-1111-1111-111111111111', '2026-08-23', 9461, 52, 2450),
  ('22222222-2222-2222-2222-222222222222', '2026-08-23', 3120, 71, 2980);


-- ------------------------------------------------------------ como Ana ---

set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  n integer;
  peso numeric;
begin
  select count(*) into n from public.weight_logs;
  assert n = 1, format('Ana deberia ver 1 peso, ve %s', n);

  select peso_kg into peso from public.weight_logs;
  assert peso = 78.9, format('Ana ve el peso equivocado: %s', peso);

  -- El alimento semilla lo ve todo el mundo.
  select count(*) into n from public.foods where publico;
  assert n = 1, format('Ana deberia ver 1 alimento publico, ve %s', n);

  select count(*) into n from public.daily_metrics;
  assert n = 1, format('Ana deberia ver 1 dia de metricas, ve %s', n);

  select pasos into n from public.daily_metrics;
  assert n = 9461, format('Ana ve los pasos de otro: %s', n);
end;
$$;

-- Ana no puede escribir en el diario de Beto ni aunque lo intente a mano.
do $$
begin
  begin
    insert into public.weight_logs (user_id, fecha, peso_kg)
    values ('22222222-2222-2222-2222-222222222222', '2026-08-24', 90.0);
    raise exception 'FALLO: Ana pudo escribir un peso a nombre de Beto';
  exception
    when insufficient_privilege then null;  -- lo esperado
  end;
end;
$$;

-- Nadie asciende un alimento propio a público desde el cliente.
do $$
begin
  begin
    insert into public.foods (slug, nombre, categoria, kcal100, p100, c100, g100,
                              publico, creado_por)
    values ('colado', 'Alimento colado', 'Verdura', 10, 1, 1, 0, true,
            '11111111-1111-1111-1111-111111111111');
    raise exception 'FALLO: se pudo crear un alimento publico desde el cliente';
  exception
    when insufficient_privilege or check_violation then null;  -- lo esperado
  end;
end;
$$;

-- Un alimento propio sí, y queda privado.
insert into public.foods (slug, nombre, categoria, kcal100, p100, c100, g100,
                          publico, creado_por)
values ('sancocho-de-la-abuela', 'Sancocho de la abuela', 'Proteina animal',
        120, 8, 10, 5, false, '11111111-1111-1111-1111-111111111111');


-- ----------------------------------------------------------- como Beto ---

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare
  n integer;
  peso numeric;
begin
  select count(*) into n from public.weight_logs;
  assert n = 1, format('Beto deberia ver 1 peso, ve %s', n);

  select peso_kg into peso from public.weight_logs;
  assert peso = 91.4, format('Beto ve el peso de otro: %s', peso);

  -- El alimento privado de Ana no existe para Beto.
  select count(*) into n from public.foods where slug = 'sancocho-de-la-abuela';
  assert n = 0, 'FUGA: Beto ve un alimento privado de Ana';

  -- Pero el público sí.
  select count(*) into n from public.foods where slug = 'arepa-media-tela';
  assert n = 1, 'Beto no ve el alimento publico';
end;
$$;


-- ------------------------------------------------------- sin sesión ---

set request.jwt.claim.sub = '';

do $$
declare n integer;
begin
  select count(*) into n from public.weight_logs;
  assert n = 0, format('Sin sesion no se deberia ver ningun peso, se ven %s', n);

  select count(*) into n from public.meal_logs;
  assert n = 0, format('Sin sesion no se deberia ver ninguna comida, se ven %s', n);

  select count(*) into n from public.daily_metrics;
  assert n = 0, format('Sin sesion no se deberian ver metricas, se ven %s', n);
end;
$$;

reset role;

select '✓ RLS: el aislamiento entre usuarios se sostiene' as resultado;
