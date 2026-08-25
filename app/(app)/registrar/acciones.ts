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

/**
 * Borra una comida del diario. El borrado en cascada se lleva los ítems.
 *
 * También se lleva la foto. Sin esto, borrar una comida dejaba la imagen en
 * el almacenamiento para siempre: alguien que borra el registro de lo que
 * comió no espera que la foto del plato siga guardada.
 */
export async function borrarComida(comidaId: string): Promise<ResultadoGuardar> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

  // La ruta hay que leerla antes: después del borrado ya no hay de dónde.
  const { data: previa } = await supabase
    .from("meal_logs")
    .select("scan_sessions ( foto_path )")
    .eq("id", comidaId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", comidaId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  // Va después del borrado y sin comprobar el resultado a propósito: si esto
  // falla, la comida ya no está y el diario quedó bien. Una foto suelta es un
  // problema de limpieza, no algo que deba hacer fallar el borrado.
  const rutaFoto = previa?.scan_sessions?.foto_path;
  if (rutaFoto) await supabase.storage.from("comidas").remove([rutaFoto]);

  revalidatePath("/hoy");
  revalidatePath("/historial");
  return { ok: true, comidaId, kcal: 0 };
}

/**
 * Reemplaza una comida ya guardada.
 *
 * Corregir después es tan parte del uso normal como registrar: uno pesa el
 * arroz cuando ya se sentó a comer, o se acuerda del jugo a la noche. Sin esto
 * la única salida era borrar y volver a cargar todo.
 *
 * Los ítems se borran y se vuelven a insertar en vez de actualizarse uno por
 * uno. Editar significa también quitar y agregar filas, y casar dos listas por
 * id es la clase de código donde se cuelan ítems huérfanos.
 *
 * Queda marcada como `corregido`. Es el dato que después dice cuánto hubo que
 * arreglar de lo que estimó el modelo.
 */
export async function actualizarComida(
  comidaId: string,
  borrador: unknown,
): Promise<ResultadoGuardar> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

  const analisis = ComidaBorradorSchema.safeParse(borrador);
  if (!analisis.success) {
    const primero = analisis.error.issues[0];
    return {
      ok: false,
      error: `Dato inválido en "${primero.path.join(".")}": ${primero.message}`,
    };
  }

  const comida = analisis.data;

  const conAmbas = comida.items.find(
    (i) => i.porcionG !== null && i.porcionMl !== null,
  );
  if (conAmbas) {
    return {
      ok: false,
      error: `"${conAmbas.alimento}" tiene gramos y mililitros a la vez. Dejá solo uno.`,
    };
  }

  // Que la comida sea de quien la edita se comprueba en el update, con el
  // filtro por user_id: si no es suya, no actualiza ninguna fila y se avisa.
  const { data: actualizada, error: errComida } = await supabase
    .from("meal_logs")
    .update({
      momento: comida.momento,
      confianza: comida.confianza,
      corregido: true,
      nota: comida.nota,
    })
    .eq("id", comidaId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (errComida) return { ok: false, error: errComida.message };
  if (!actualizada) {
    return { ok: false, error: "Esa comida ya no existe." };
  }

  const { error: errBorrar } = await supabase
    .from("meal_log_items")
    .delete()
    .eq("meal_log_id", comidaId)
    .eq("user_id", user.id);
  if (errBorrar) return { ok: false, error: errBorrar.message };

  const { error: errItems } = await supabase.from("meal_log_items").insert(
    comida.items.map((item, orden) => ({
      meal_log_id: comidaId,
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

  // Si esto falla, la comida quedó sin ítems: cuenta cero y descuadra el día
  // en silencio. Vale más decirlo fuerte que dejarlo pasar.
  if (errItems) {
    return {
      ok: false,
      error:
        `No se pudieron guardar los ítems (${errItems.message}). ` +
        `La comida quedó vacía: volvé a editarla para dejarla bien.`,
    };
  }

  revalidatePath("/hoy");
  revalidatePath("/historial");

  return {
    ok: true,
    comidaId,
    kcal: comida.items.reduce((n, i) => n + i.kcal, 0),
  };
}
