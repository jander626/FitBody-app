/**
 * Genera el SQL de importación para pegar en el SQL Editor de Supabase.
 *
 * Es la alternativa a `npm run import` para cuando no hay terminal a mano: el
 * editor de Supabase corre como superusuario, así que no hace falta la clave
 * de servicio ni instalar nada.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/generar-sql-importacion.ts <email> <carpeta>
 *
 * Produce dos archivos, que se pegan en ese orden:
 *   01-alimentos.sql   los 133 alimentos. No depende de ninguna cuenta.
 *   02-mi-historia.sql perfil, objetivo, pesajes y comidas. Necesita que la
 *                      cuenta exista, así que va DESPUÉS del primer login.
 *
 * El segundo resuelve el usuario por correo (`where email = ...`) en vez de
 * pedir un uuid: el uuid no se conoce hasta que la cuenta existe, y copiarlo a
 * mano es justo el paso donde se cometen errores.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { leerBitacora } from "../lib/importacion/lectura";

const email = process.argv[2];
const salida = process.argv[3] ?? "sql-para-supabase";
const repo = process.env.FITFOOD_REPO_PATH ?? "../fitfood";

if (!email) {
  console.error("Falta el correo de la cuenta. Ej: ... generar-sql-importacion.ts vos@ejemplo.com");
  process.exit(1);
}

/** Escapa un valor para SQL. */
function sql(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return "null";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "true" : "false";
  return `'${valor.replace(/'/g, "''")}'`;
}

/** Subconsulta que resuelve el usuario por correo. */
const USUARIO = `(select id from auth.users where email = ${sql(email)})`;

async function main() {
  const bitacora = await leerBitacora(repo);
  await mkdir(salida, { recursive: true });

  // ------------------------------------------------- 01 · alimentos ---

  const alimentos = [
    "-- FitFood · paso 1 de 2: la tabla de alimentos",
    "--",
    `-- ${bitacora.foods.length} alimentos de la bitácora. No depende de ninguna cuenta,`,
    "-- así que esto se puede correr apenas creado el proyecto.",
    "--",
    "-- Se puede volver a correr sin problema: si un alimento ya está, lo actualiza.",
    "",
    "begin;",
    "",
    ...bitacora.foods.map(
      (f) =>
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
        `) on conflict (slug) do update set ` +
        `nombre = excluded.nombre, categoria = excluded.categoria, ` +
        `kcal100 = excluded.kcal100, p100 = excluded.p100, ` +
        `c100 = excluded.c100, g100 = excluded.g100, ` +
        `porcion_g = excluded.porcion_g, porcion_nota = excluded.porcion_nota;`,
    ),
    "",
    "commit;",
    "",
    `select count(*) || ' alimentos cargados' as resultado from public.foods where publico;`,
  ].join("\n");

  await writeFile(path.join(salida, "01-alimentos.sql"), alimentos);

  // ---------------------------------------------- 02 · mi historia ---

  const lineas: string[] = [
    "-- FitFood · paso 2 de 2: tu historia",
    "--",
    "-- Perfil, objetivo, pesajes y comidas de la bitácora.",
    "--",
    `-- IMPORTANTE: esto necesita que la cuenta ${email} ya exista, o sea que`,
    "-- hay que entrar UNA VEZ a la app antes de correrlo. Si no, falla con un",
    "-- mensaje sobre 'null value in column user_id'.",
    "--",
    "-- Se puede volver a correr: reemplaza los días en vez de duplicarlos.",
    "",
    "begin;",
    "",
    "-- Aviso temprano y claro si la cuenta todavía no existe.",
    "do $$",
    "begin",
    `  if ${USUARIO} is null then`,
    `    raise exception 'La cuenta ${email} no existe todavía. Entrá una vez a la app con ese correo y volvé a correr esto.';`,
    "  end if;",
    "end;",
    "$$;",
    "",
    "-- El perfil lo creó un trigger al registrarse: acá se completa.",
  ];

  const p = bitacora.perfil;
  lineas.push(
    `update public.profiles set edad = ${sql(p.edad)}, sexo = ${sql(p.sexo)}, ` +
      `estatura_cm = ${sql(p.estatura_cm)}, fecha_dia_1 = ${sql(p.fecha_dia_1)} ` +
      `where id = ${USUARIO};`,
    "",
    "-- Un solo objetivo activo: se desactiva cualquier anterior.",
    `update public.user_goals set activo = false where user_id = ${USUARIO} and activo;`,
  );

  const o = bitacora.objetivo;
  lineas.push(
    `insert into public.user_goals (user_id, objetivo, peso_meta_kg, factor_actividad, deficit_pct, kcal, proteina_g, carbs_g, grasa_g, activo, motivo) values (` +
      [
        USUARIO,
        sql(o.objetivo),
        sql(o.peso_meta_kg),
        sql(o.factor_actividad),
        sql(o.deficit_pct),
        sql(o.kcal),
        sql(o.proteina_g),
        sql(o.carbs_g),
        sql(o.grasa_g),
        "true",
        sql("Importado de la bitácora fitfood"),
      ].join(", ") +
      ");",
    "",
    "-- Pesajes.",
  );

  for (const w of bitacora.pesos) {
    lineas.push(
      `insert into public.weight_logs (user_id, fecha, peso_kg, condiciones, nota) values (` +
        [USUARIO, sql(w.fecha), sql(w.peso_kg), sql(w.condiciones), sql(w.nota)].join(", ") +
        `) on conflict (user_id, fecha) do update set peso_kg = excluded.peso_kg;`,
    );
  }

  lineas.push("", "-- Comidas. Cada día se reemplaza entero para no duplicar.");

  const fechas = [...new Set(bitacora.dias.map((d) => d.fecha))];
  lineas.push(
    `delete from public.meal_logs where user_id = ${USUARIO} and fecha in (${fechas.map(sql).join(", ")});`,
    "",
  );

  for (const dia of bitacora.dias) {
    for (const c of dia.comidas) {
      lineas.push(
        "with nueva as (",
        `  insert into public.meal_logs (user_id, fecha, momento, hora, confianza, origen, corregido, nota) values (` +
          [
            USUARIO,
            sql(c.fecha),
            sql(c.momento),
            sql(c.hora),
            sql(c.confianza),
            sql(c.origen),
            sql(c.corregido),
            sql(c.nota),
          ].join(", ") +
          ") returning id",
        ")",
        "insert into public.meal_log_items (meal_log_id, user_id, food_id, alimento, porcion_g, porcion_ml, kcal, proteina_g, carbs_g, grasa_g, nota_correccion, nota, orden)",
        `select nueva.id, ${USUARIO},` +
          // Enlaza con la tabla de alimentos cuando el nombre coincide.
          " (select f.id from public.foods f where lower(f.nombre) = lower(v.alimento) limit 1)," +
          " v.alimento, v.porcion_g, v.porcion_ml, v.kcal, v.proteina_g, v.carbs_g," +
          " v.grasa_g, v.nota_correccion, v.nota, v.orden",
        "from nueva, (values " +
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
        "",
      );
    }
  }

  const totalItems = bitacora.dias
    .flatMap((d) => d.comidas)
    .reduce((n, c) => n + c.items.length, 0);
  const totalComidas = bitacora.dias.reduce((n, d) => n + d.comidas.length, 0);

  lineas.push(
    "commit;",
    "",
    `select '✓ listo: ' ||`,
    `  (select count(*) from public.weight_logs where user_id = ${USUARIO}) || ' pesajes, ' ||`,
    `  (select count(*) from public.meal_logs where user_id = ${USUARIO}) || ' comidas, ' ||`,
    `  (select count(*) from public.meal_log_items where user_id = ${USUARIO}) || ' ítems' as resultado;`,
  );

  await writeFile(path.join(salida, "02-mi-historia.sql"), lineas.join("\n"));

  console.log(
    `✓ ${salida}/01-alimentos.sql    — ${bitacora.foods.length} alimentos\n` +
      `✓ ${salida}/02-mi-historia.sql — ${bitacora.pesos.length} pesajes, ${totalComidas} comidas, ${totalItems} ítems\n` +
      `  (cuenta: ${email})`,
  );
}

main().catch((err) => {
  console.error("✗", err.message ?? err);
  process.exit(1);
});
