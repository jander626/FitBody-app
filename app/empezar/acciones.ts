"use server";

import { revalidatePath } from "next/cache";
import { guardarPlanDeEntrada, type ResultadoGuardarPlan } from "@/lib/datos/guardar-plan";
import { EntradaSchema } from "@/lib/entrada/entrada";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Rehacer el plan estando dentro: el mismo cuestionario del principio, pero al
 * final se guarda directo, sin pedir cuenta.
 *
 * Las respuestas vienen del cliente, así que se validan con el mismo esquema
 * que usa la creación de cuenta. El historial no se toca: el objetivo anterior
 * queda desactivado, y las comidas y los pesos siguen donde estaban.
 */
export async function rehacerPlan(entrada: unknown): Promise<ResultadoGuardarPlan> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entra de nuevo." };

  const analisis = EntradaSchema.safeParse(entrada);
  if (!analisis.success) return { ok: false, error: "Faltan datos o alguno no es válido. Revisa tus respuestas." };

  const resultado = await guardarPlanDeEntrada(supabase, user.id, analisis.data, "Plan rehecho desde el cuestionario");
  if (resultado.ok) {
    revalidatePath("/hoy");
    revalidatePath("/perfil");
    revalidatePath("/peso");
    revalidatePath("/consejos");
  }
  return resultado;
}
