import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { planDeEntrada, type Entrada } from "@/lib/entrada/entrada";
import type { Database } from "@/lib/supabase/tipos-db";
import { fechaDeHoy } from "./diario";

export type ResultadoGuardarPlan = { ok: true; kcal: number } | { ok: false; error: string };

/**
 * Escribe el plan que sale de las respuestas del cuestionario: perfil, peso de
 * hoy y un objetivo nuevo.
 *
 * Lo usan dos caminos —crear la cuenta (primer plan) y rehacer el plan desde
 * Perfil— para que no haya dos formas de convertir las mismas respuestas en
 * números. El objetivo se versiona: se desactiva el anterior y se crea uno
 * nuevo, así queda registrado con qué plan se vivió cada tramo, y rehacer el
 * plan nunca borra historia.
 */
export async function guardarPlanDeEntrada(
  supabase: SupabaseClient<Database>,
  userId: string,
  entrada: Entrada,
  motivo: string,
): Promise<ResultadoGuardarPlan> {
  const { calculo, parametros } = planDeEntrada(entrada);

  const { error: errPerfil } = await supabase
    .from("profiles")
    .update({ edad: entrada.edad, sexo: entrada.sexo, estatura_cm: entrada.estaturaCm })
    .eq("id", userId);
  if (errPerfil) return { ok: false, error: errPerfil.message };

  // El peso de hoy: si ya te pesaste, esto lo corrige en vez de duplicarlo.
  const { error: errPeso } = await supabase
    .from("weight_logs")
    .upsert(
      { user_id: userId, fecha: await fechaDeHoy(), peso_kg: entrada.pesoKg },
      { onConflict: "user_id,fecha" },
    );
  if (errPeso) return { ok: false, error: errPeso.message };

  const { error: errDesactivar } = await supabase
    .from("user_goals")
    .update({ activo: false })
    .eq("user_id", userId)
    .eq("activo", true);
  if (errDesactivar) return { ok: false, error: errDesactivar.message };

  const { error: errObjetivo } = await supabase.from("user_goals").insert({
    user_id: userId,
    objetivo: parametros.objetivo,
    peso_meta_kg: entrada.pesoMetaKg ?? null,
    factor_actividad: parametros.factorActividad,
    deficit_pct: parametros.deficitPct,
    kcal: calculo.kcalObjetivo,
    proteina_g: calculo.proteinaG,
    carbs_g: calculo.carbsG,
    grasa_g: calculo.grasaG,
    activo: true,
    motivo,
  });
  if (errObjetivo) return { ok: false, error: errObjetivo.message };

  return { ok: true, kcal: calculo.kcalObjetivo };
}
