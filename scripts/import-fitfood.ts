/**
 * Importa la bitácora de jander626/fitfood a Supabase.
 *
 *   FITFOOD_REPO_PATH=../fitfood FITFOOD_IMPORT_EMAIL=vos@ejemplo.com npm run import
 *
 * Es idempotente: se puede correr las veces que haga falta. Los alimentos y
 * los pesos se reconcilian por su clave natural; cada día de comidas se
 * reemplaza entero, que es más simple y más fiel que reconciliar comida por
 * comida.
 *
 * El repo de la bitácora NO se toca: esto es lectura de una sola vez.
 *
 * Usa la clave de servicio, que salta RLS — por eso es un script local y no un
 * endpoint. La lectura y el mapeo viven en lib/importacion/, así que
 * scripts/verificar-importacion.sh puede probar exactamente este mismo camino
 * contra un Postgres desechable.
 */
import { createClient } from "@supabase/supabase-js";
import { config as cargarEnv } from "dotenv";
import { leerBitacora } from "../lib/importacion/lectura";
import { normalizar } from "../lib/importacion/mapeo";
import type { Database } from "../lib/supabase/tipos-db";

cargarEnv({ path: ".env.local", quiet: true });

const REPO = process.env.FITFOOD_REPO_PATH ?? "../fitfood";

function exigir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) {
    console.error(`✗ Falta ${nombre}. Ver .env.example.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const url = exigir("NEXT_PUBLIC_SUPABASE_URL");
  const clave = exigir("SUPABASE_SERVICE_ROLE_KEY");
  const email = exigir("FITFOOD_IMPORT_EMAIL");

  const db = createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`→ Leyendo la bitácora de ${REPO}`);
  const bitacora = await leerBitacora(REPO);

  // --- a quién le pertenecen estos datos ---
  const { data: usuarios, error: errUsuarios } = await db.auth.admin.listUsers({
    perPage: 1000,
  });
  if (errUsuarios) throw errUsuarios;

  const usuario = usuarios.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!usuario) {
    console.error(
      `✗ No existe una cuenta con ${email}. Entrá una vez a /login con ese ` +
        `correo para crearla y volvé a correr esto.`,
    );
    process.exit(1);
  }
  const userId = usuario.id;
  console.log(`→ Importando a la cuenta ${email}`);

  // --- alimentos ---
  const { error: errFoods } = await db.from("foods").upsert(
    bitacora.foods.map((f) => ({ ...f, publico: true, creado_por: null })),
    { onConflict: "slug" },
  );
  if (errFoods) throw errFoods;
  console.log(`  ✓ ${bitacora.foods.length} alimentos`);

  // Índice nombre normalizado → id, para enlazar los ítems que coincidan.
  const { data: foods, error: errLista } = await db
    .from("foods")
    .select("id, nombre")
    .eq("publico", true);
  if (errLista) throw errLista;
  const porNombre = new Map(foods.map((f) => [normalizar(f.nombre), f.id]));

  // --- perfil y objetivo ---
  const { error: errPerfil } = await db
    .from("profiles")
    .upsert({ id: userId, ...bitacora.perfil });
  if (errPerfil) throw errPerfil;

  // Un solo objetivo activo por persona: hay un índice único parcial que lo
  // exige, así que primero se desactivan los anteriores.
  const { error: errDesactivar } = await db
    .from("user_goals")
    .update({ activo: false })
    .eq("user_id", userId)
    .eq("activo", true);
  if (errDesactivar) throw errDesactivar;

  const { error: errObjetivo } = await db.from("user_goals").insert({
    user_id: userId,
    ...bitacora.objetivo,
    activo: true,
    motivo: "Importado de la bitácora fitfood",
  });
  if (errObjetivo) throw errObjetivo;

  const o = bitacora.objetivo;
  console.log(
    `  ✓ perfil y objetivo (${o.kcal} kcal, ${o.proteina_g}P/${o.carbs_g}C/${o.grasa_g}G)`,
  );

  // --- pesos ---
  const { error: errPeso } = await db.from("weight_logs").upsert(
    bitacora.pesos.map((p) => ({ user_id: userId, ...p })),
    { onConflict: "user_id,fecha" },
  );
  if (errPeso) throw errPeso;
  const conCintura = bitacora.pesos.filter((p) => p.cintura_cm !== null).length;
  console.log(
    `  ✓ ${bitacora.pesos.length} pesajes` +
      (conCintura > 0 ? `, ${conCintura} con medida de cintura` : ""),
  );
  for (const fecha of bitacora.cinturasHuerfanas) {
    console.warn(
      `  ! cintura del ${fecha} sin pesaje ese día: no se pudo guardar`,
    );
  }

  // --- comidas ---
  let items = 0;
  let enlazados = 0;

  for (const dia of bitacora.dias) {
    // Reimportar un día lo reemplaza entero; el borrado en cascada se lleva
    // los ítems.
    const { error: errBorrar } = await db
      .from("meal_logs")
      .delete()
      .eq("user_id", userId)
      .eq("fecha", dia.fecha);
    if (errBorrar) throw errBorrar;

    for (const comida of dia.comidas) {
      const { data: registro, error: errComida } = await db
        .from("meal_logs")
        .insert({
          user_id: userId,
          fecha: comida.fecha,
          momento: comida.momento,
          hora: comida.hora,
          confianza: comida.confianza,
          origen: comida.origen,
          corregido: comida.corregido,
          nota: comida.nota,
        })
        .select("id")
        .single();
      if (errComida) throw errComida;

      const filas = comida.items.map((item) => {
        const foodId = porNombre.get(item.clave_alimento) ?? null;
        if (foodId) enlazados++;
        return {
          meal_log_id: registro.id,
          user_id: userId,
          food_id: foodId,
          alimento: item.alimento,
          porcion_g: item.porcion_g,
          porcion_ml: item.porcion_ml,
          kcal: item.kcal,
          proteina_g: item.proteina_g,
          carbs_g: item.carbs_g,
          grasa_g: item.grasa_g,
          nota_correccion: item.nota_correccion,
          nota: item.nota,
          orden: item.orden,
        };
      });

      const { error: errItems } = await db.from("meal_log_items").insert(filas);
      if (errItems) throw errItems;
      items += filas.length;
    }
  }

  console.log(
    `  ✓ ${bitacora.dias.length} días, ${items} ítems ` +
      `(${enlazados} enlazados a la tabla de alimentos; ` +
      `${bitacora.diasSalteados} día(s) de pre-plan salteados)`,
  );
  console.log("\n✓ Importación lista. La bitácora quedó intacta.");
}

main().catch((err) => {
  console.error("\n✗ La importación falló:", err.message ?? err);
  process.exit(1);
});
