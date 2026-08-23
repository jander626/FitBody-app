"use server";

import { revalidatePath } from "next/cache";
import { ComidaBorradorSchema } from "@/lib/registro/tipos";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

export type ResultadoGuardar =
  | { ok: true; comidaId: string; kcal: number }
  | { ok: false; error: string };

/**
 * Guarda una comida con sus ítems.
 *
 * Único punto de escritura del diario: lo usan el registro manual y, más
 * adelante, la tarjeta de revisión de la IA. La forma del borrador es la misma
 * en los dos casos, así que no hay dos caminos que se puedan desincronizar.
 */
export async function guardarComida(
  borrador: unknown,
): Promise<ResultadoGuardar> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

  // El borrador viene del cliente: se valida acá antes de tocar la base.
  const analisis = ComidaBorradorSchema.safeParse(borrador);
  if (!analisis.success) {
    const primero = analisis.error.issues[0];
    return {
      ok: false,
      error: `Dato inválido en "${primero.path.join(".")}": ${primero.message}`,
    };
  }

  const comida = analisis.data;

  // La restricción de la tabla exige gramos o mililitros, nunca ambos. Se
  // comprueba acá para poder dar un mensaje entendible en vez de un error de
  // Postgres.
  const conAmbas = comida.items.find(
    (i) => i.porcionG !== null && i.porcionMl !== null,
  );
  if (conAmbas) {
    return {
      ok: false,
      error: `"${conAmbas.alimento}" tiene gramos y mililitros a la vez. Dejá solo uno.`,
    };
  }

  const { data: registro, error: errComida } = await supabase
    .from("meal_logs")
    .insert({
      user_id: user.id,
      fecha: comida.fecha,
      momento: comida.momento,
      origen: comida.origen,
      confianza: comida.confianza,
      corregido: comida.corregido,
      nota: comida.nota,
      scan_session_id: comida.scanSessionId,
    })
    .select("id")
    .single();

  if (errComida) return { ok: false, error: errComida.message };

  const { error: errItems } = await supabase.from("meal_log_items").insert(
    comida.items.map((item, orden) => ({
      meal_log_id: registro.id,
      user_id: user.id,
      food_id: item.foodId,
      alimento: item.alimento,
      porcion_g: item.porcionG,
      porcion_ml: item.porcionMl,
      kcal: item.kcal,
      proteina_g: item.proteinaG,
      carbs_g: item.carbsG,
      grasa_g: item.grasaG,
      nota: item.nota,
      orden,
    })),
  );

  if (errItems) {
    // Sin los ítems, la comida es una fila vacía que ensucia el diario y
    // desajusta los totales. Se deshace.
    await supabase.from("meal_logs").delete().eq("id", registro.id);
    return { ok: false, error: errItems.message };
  }

  revalidatePath("/hoy");
  revalidatePath("/registrar");

  return {
    ok: true,
    comidaId: registro.id,
    kcal: comida.items.reduce((n, i) => n + i.kcal, 0),
  };
}

/** Borra una comida del diario. El borrado en cascada se lleva los ítems. */
export async function borrarComida(comidaId: string): Promise<ResultadoGuardar> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", comidaId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/hoy");
  return { ok: true, comidaId, kcal: 0 };
}
