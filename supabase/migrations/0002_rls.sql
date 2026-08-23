-- FitFood — Row Level Security.
--
-- Regla única y aburrida: cada quien ve y escribe solo sus filas.
-- La excepción son los alimentos públicos (la tabla semilla), que todo el
-- mundo lee y nadie modifica.
--
-- auth.uid() va envuelto en (select ...) a propósito: así Postgres lo evalúa
-- una vez por consulta en vez de una vez por fila.

alter table public.profiles       enable row level security;
alter table public.user_goals     enable row level security;
alter table public.foods          enable row level security;
alter table public.scan_sessions  enable row level security;
alter table public.scan_turns     enable row level security;
alter table public.meal_logs      enable row level security;
alter table public.meal_log_items enable row level security;
alter table public.weight_logs    enable row level security;


-- ---------------------------------------------------------------- perfil ---
-- Sin política de insert: la fila la crea el trigger al registrarse, y no hay
-- razón para que el cliente cree perfiles sueltos.

create policy "perfil propio: leer" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "perfil propio: actualizar" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);


-- --------------------------------------------- tablas con user_id directo ---

create policy "objetivos propios" on public.user_goals
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sesiones propias" on public.scan_sessions
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "turnos propios" on public.scan_turns
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "comidas propias" on public.meal_logs
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "items propios" on public.meal_log_items
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "pesos propios" on public.weight_logs
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- -------------------------------------------------------------- alimentos ---

-- La tabla semilla la lee cualquiera que haya iniciado sesión.
create policy "alimentos publicos: leer" on public.foods
  for select using (publico or (select auth.uid()) = creado_por);

-- Solo se pueden crear alimentos propios, y solo privados: nadie asciende una
-- fila a pública desde el cliente (el check de la tabla lo respalda).
create policy "alimentos propios: crear" on public.foods
  for insert with check ((select auth.uid()) = creado_por and not publico);

create policy "alimentos propios: actualizar" on public.foods
  for update using ((select auth.uid()) = creado_por and not publico)
  with check ((select auth.uid()) = creado_por and not publico);

create policy "alimentos propios: borrar" on public.foods
  for delete using ((select auth.uid()) = creado_por and not publico);
