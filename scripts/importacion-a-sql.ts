/**
 * Emite la bitácora como SQL, para verificar la importación sin Supabase.
 *
 * Usa exactamente el mismo lector que el importador real
 * (lib/importacion/lectura.ts), así que si esto entra en el esquema, la
 * importación de verdad también. Lo corre scripts/verificar-importacion.sh.
 *
 *   FITFOOD_REPO_PATH=../fitfood npx tsx scripts/importacion-a-sql.ts > /tmp/import.sql
 */
import { leerBitacora } from "../lib/importacion/lectura";

const REPO = process.env.FITFOOD_REPO_PATH ?? "../fitfood";
const USER_ID = "11111111-1111-1111-1111-111111111111";

/** Escapa un valor para SQL. Nada de esto toca datos ajenos ni una base real. */
function sql(valor: string | number | boolean | null): string {
  if (valor === null) return "null";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "true" : "false";
  return `'${valor.replace(/'/g, "''")}'`;
}

async function main() {
const bitacora = await leerBitacora(REPO);
const lineas: string[] = [];

lineas.push("-- Generado por scripts/importacion-a-sql.ts. No versionar.");
lineas.push("begin;");
lineas.push(
  `insert into auth.users (id, email) values (${sql(USER_ID)}, 'prueba@example.com');`,
);

// --- alimentos ---
for (const f of bitacora.foods) {
  lineas.push(
    `insert into public.foods (slug, nombre, categoria, kcal100, p100, c100, g100, porcion_g, porcion_nota, publico, creado_por) values (` +
      [
        sql(f.slug),
        sql(f.nombre),
        sql(f.categoria),
        sql(f.kcal100),
        sql(f.p100),
        sql(f.c100),
        sql(f.g100),
        sql(f.porcion_g),
        sql(f.porcion_nota),
        "true",
        "null",
      ].join(", ") +
      ") on conflict (slug) do nothing;",
  );
}

// --- perfil (el trigger ya lo creó: se actualiza) y objetivo ---
const p = bitacora.perfil;
lineas.push(
  `update public.profiles set edad = ${sql(p.edad)}, sexo = ${sql(p.sexo)}, ` +
    `estatura_cm = ${sql(p.estatura_cm)}, fecha_dia_1 = ${sql(p.fecha_dia_1)} ` +
    `where id = ${sql(USER_ID)};`,
);

const o = bitacora.objetivo;
lineas.push(
  `insert into public.user_goals (user_id, objetivo, peso_meta_kg, factor_actividad, deficit_pct, kcal, proteina_g, carbs_g, grasa_g, activo) values (` +
    [
      sql(USER_ID),
      sql(o.objetivo),
      sql(o.peso_meta_kg),
      sql(o.factor_actividad),
      sql(o.deficit_pct),
      sql(o.kcal),
      sql(o.proteina_g),
      sql(o.carbs_g),
      sql(o.grasa_g),
      "true",
    ].join(", ") +
    ");",
);

// --- pesos ---
for (const w of bitacora.pesos) {
  lineas.push(
    `insert into public.weight_logs (user_id, fecha, peso_kg, condiciones, nota) values (` +
      [sql(USER_ID), sql(w.fecha), sql(w.peso_kg), sql(w.condiciones), sql(w.nota)].join(", ") +
      ") on conflict (user_id, fecha) do nothing;",
  );
}

// --- comidas ---
for (const dia of bitacora.dias) {
  for (const c of dia.comidas) {
    lineas.push("with nueva as (");
    lineas.push(
      `  insert into public.meal_logs (user_id, fecha, momento, hora, confianza, origen, corregido, nota) values (` +
        [
          sql(USER_ID),
          sql(c.fecha),
          sql(c.momento),
          sql(c.hora),
          sql(c.confianza),
          sql(c.origen),
          sql(c.corregido),
          sql(c.nota),
        ].join(", ") +
        ") returning id",
    );
    lineas.push(")");
    lineas.push(
      "insert into public.meal_log_items (meal_log_id, user_id, alimento, porcion_g, porcion_ml, kcal, proteina_g, carbs_g, grasa_g, nota_correccion, nota, orden)",
    );
    lineas.push(
      "select nueva.id, " +
        sql(USER_ID) +
        ", v.* from nueva, (values " +
        c.items
          .map(
            (i) =>
              "(" +
              [
                sql(i.alimento),
                `${sql(i.porcion_g)}::numeric`,
                `${sql(i.porcion_ml)}::numeric`,
                sql(i.kcal),
                sql(i.proteina_g),
                sql(i.carbs_g),
                sql(i.grasa_g),
                `${sql(i.nota_correccion)}::text`,
                `${sql(i.nota)}::text`,
                sql(i.orden),
              ].join(", ") +
              ")",
          )
          .join(", ") +
        ") as v(alimento, porcion_g, porcion_ml, kcal, proteina_g, carbs_g, grasa_g, nota_correccion, nota, orden);",
    );
  }
}

// --- comprobaciones dentro de la misma transacción ---
const totalItems = bitacora.dias
  .flatMap((d) => d.comidas)
  .reduce((n, c) => n + c.items.length, 0);
const totalComidas = bitacora.dias.reduce((n, d) => n + d.comidas.length, 0);

lineas.push(`
do $$
declare n integer; suma numeric; declarado numeric;
begin
  select count(*) into n from public.foods;
  assert n = ${bitacora.foods.length}, format('alimentos: %s != ${bitacora.foods.length}', n);

  select count(*) into n from public.weight_logs;
  assert n = ${bitacora.pesos.length}, format('pesajes: %s != ${bitacora.pesos.length}', n);

  select count(*) into n from public.meal_logs;
  assert n = ${totalComidas}, format('comidas: %s != ${totalComidas}', n);

  select count(*) into n from public.meal_log_items;
  assert n = ${totalItems}, format('items: %s != ${totalItems}', n);

  -- La regresión que importa: si la traducción perdiera o duplicara un ítem,
  -- las calorías guardadas dejarían de coincidir con las de la bitácora.
  select sum(kcal) into suma from public.meal_log_items;
  declarado := ${bitacora.dias.reduce((n, d) => n + d.total_kcal, 0)};
  assert abs(suma - declarado) <= 1.0,
    format('kcal importadas %s vs bitacora %s', suma, declarado);
end;
$$;`);

lineas.push("commit;");
lineas.push(
  `select '✓ importación: ${bitacora.foods.length} alimentos, ${bitacora.pesos.length} pesajes, ${totalComidas} comidas, ${totalItems} ítems' as resultado;`,
);

console.log(lineas.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
