import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { entradaDeMetadata } from "@/lib/entrada/entrada";
import type { Database } from "@/lib/supabase/tipos-db";
import { guardarPlanDeEntrada } from "./guardar-plan";

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

  const resultado = await guardarPlanDeEntrada(supabase, user.id, entrada, "Creado en el flujo de entrada");
  if (!resultado.ok) return { aplicado: false, motivo: "error" };

  // Las respuestas ya están donde deben. Dejarlas en los metadatos sería
  // guardar dos veces datos de salud, y una de ellas sin que nadie la use.
  // Si falla no importa: el objetivo activo impide que se vuelvan a aplicar.
  await supabase.auth.updateUser({ data: { entrada: null } }).catch(() => {});

  return { aplicado: true, kcal: resultado.kcal };
}
