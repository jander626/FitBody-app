import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { entradaDeMetadata, planDeEntrada } from "@/lib/entrada/entrada";
import type { Database } from "@/lib/supabase/tipos-db";
import { fechaDeHoy } from "./diario";

export type ResultadoEntrada =
  | { aplicado: true; kcal: number }
  | { aplicado: false; motivo: "sin_respuestas" | "ya_tenia_objetivo" | "error" };

/**
 * Convierte las respuestas del flujo de entrada en perfil, peso y objetivo.
 *
 * Corre una sola vez, al canjear el primer enlace de acceso. Nunca pisa un
 * objetivo que ya existe: quien vuelve a entrar (o abre un enlace viejo) no
 * debe perder el plan que ajustó. Y nunca lanza: si algo falla, la persona
 * igual entra, y la pantalla Hoy la manda a la encuesta como respaldo.
 */
export async function aplicarEntrada(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<ResultadoEntrada> {
  const entrada = entradaDeMetadata(user.user_metadata?.entrada);
  if (!entrada) return { aplicado: false, motivo: "sin_respuestas" };

  const { data: existente, error: errLectura } = await supabase
    .from("user_goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("activo", true)
    .maybeSingle();
  if (errLectura) return { aplicado: false, motivo: "error" };
  if (existente) return { aplicado: false, motivo: "ya_tenia_objetivo" };

  const { calculo, parametros } = planDeEntrada(entrada);

  const { error: errPerfil } = await supabase
    .from("profiles")
    .update({
      edad: entrada.edad,
      sexo: entrada.sexo,
      estatura_cm: entrada.estaturaCm,
    })
    .eq("id", user.id);
  if (errPerfil) return { aplicado: false, motivo: "error" };

  const { error: errPeso } = await supabase.from("weight_logs").upsert(
    { user_id: user.id, fecha: await fechaDeHoy(), peso_kg: entrada.pesoKg },
    { onConflict: "user_id,fecha" },
  );
  if (errPeso) return { aplicado: false, motivo: "error" };

  const { error: errObjetivo } = await supabase.from("user_goals").insert({
    user_id: user.id,
    objetivo: parametros.objetivo,
    peso_meta_kg: entrada.pesoMetaKg ?? null,
    factor_actividad: parametros.factorActividad,
    deficit_pct: parametros.deficitPct,
    kcal: calculo.kcalObjetivo,
    proteina_g: calculo.proteinaG,
    carbs_g: calculo.carbsG,
    grasa_g: calculo.grasaG,
    activo: true,
    motivo: "Creado en el flujo de entrada",
  });
  if (errObjetivo) return { aplicado: false, motivo: "error" };

  // Las respuestas ya están donde deben. Dejarlas en los metadatos sería
  // guardar dos veces datos de salud, y una de ellas sin que nadie la use.
  // Si falla no importa: el objetivo activo impide que se vuelvan a aplicar.
  await supabase.auth.updateUser({ data: { entrada: null } }).catch(() => {});

  return { aplicado: true, kcal: calculo.kcalObjetivo };
}
