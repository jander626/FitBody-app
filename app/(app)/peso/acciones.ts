"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PISO_KCAL, macros, type Sexo } from "@/lib/nutrition";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

const PesoSchema = z.object({
  pesoKg: z.coerce.number().min(20).max(400),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  condiciones: z.string().max(200).optional(),
  // Vacío es lo normal: el peso se toma todos los días y la cintura una vez
  // por semana. `""` no se puede pasar por coerce.number() —daría 0— así que
  // se limpia antes de convertir.
  cinturaCm: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : null))
    .refine((v) => v === null || (v >= 40 && v <= 250), {
      message: "la cintura tiene que estar entre 40 y 250 cm",
    }),
});

/** Guarda el peso del día. Un segundo pesaje corrige al primero, no se suma. */
export async function guardarPeso(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  // Todo va dentro del try a propósito. Si esto lanza —la red se cortó, o
  // Supabase no contesta— la pantalla se cae entera y quien estaba pesándose
  // pierde lo que escribió y no sabe si quedó guardado. Devolver el error lo
  // deja donde estaba, con su número intacto y un botón para reintentar.
  try {
    const supabase = await clienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

    const analisis = PesoSchema.safeParse(Object.fromEntries(datos));
    if (!analisis.success) {
      return {
        ok: false,
        error: `Revisá los datos: ${analisis.error.issues[0].message}`,
      };
    }

    const { pesoKg, fecha, condiciones, cinturaCm } = analisis.data;

    // La cintura solo se escribe cuando vino un número: corregir el peso de un
    // domingo dejando el campo vacío no puede borrar la medida de ese día.
    // Omitir la clave —en vez de mandar null— es lo que hace que el upsert la
    // deje como estaba.
    const { error } = await supabase.from("weight_logs").upsert(
      {
        user_id: user.id,
        fecha,
        peso_kg: pesoKg,
        condiciones: condiciones?.trim() || null,
        ...(cinturaCm !== null && { cintura_cm: cinturaCm }),
      },
      { onConflict: "user_id,fecha" },
    );

    if (error) return { ok: false, error: error.message };

    revalidatePath("/peso");
    revalidatePath("/perfil");
    revalidatePath("/historial");
    return {
      ok: true,
      mensaje:
        cinturaCm !== null
          ? `Guardado: ${pesoKg} kg y ${cinturaCm} cm de cintura.`
          : `Peso de hoy: ${pesoKg} kg.`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `No se pudo guardar: ${err.message}`
          : "No se pudo guardar. Probá de nuevo.",
    };
  }
}

/**
 * Acepta la sugerencia de ajuste semanal.
 *
 * Nunca se aplica sola: esto corre solo cuando la persona toca el botón. Crea
 * un objetivo nuevo y desactiva el anterior, igual que el formulario de Perfil,
 * para que quede registrado con qué plan se vivió cada tramo.
 */
export async function aceptarAjuste(kcalPropuesto: number): Promise<Resultado> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

  const [objetivoRes, perfilRes, pesoRes] = await Promise.all([
    supabase
      .from("user_goals")
      .select(
        "objetivo, peso_meta_kg, factor_actividad, deficit_pct, kcal",
      )
      .eq("user_id", user.id)
      .eq("activo", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("sexo")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("weight_logs")
      .select("peso_kg")
      .eq("user_id", user.id)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const objetivo = objetivoRes.data;
  const pesoKg = pesoRes.data?.peso_kg;
  const sexo = (perfilRes.data?.sexo ?? "hombre") as Sexo;

  if (!objetivo || pesoKg == null) {
    return {
      ok: false,
      error: "Falta el objetivo o el peso. Completá el perfil primero.",
    };
  }

  // Segunda barrera: el piso ya se respeta al calcular la sugerencia, pero
  // este valor llega del cliente y podría venir alterado.
  const piso = PISO_KCAL[sexo];
  if (kcalPropuesto < piso) {
    return {
      ok: false,
      error: `${kcalPropuesto} kcal está por debajo del piso de ${piso}.`,
    };
  }

  const reparto = macros(pesoKg, kcalPropuesto);

  const { error: errDesactivar } = await supabase
    .from("user_goals")
    .update({ activo: false })
    .eq("user_id", user.id)
    .eq("activo", true);
  if (errDesactivar) return { ok: false, error: errDesactivar.message };

  const { error: errNuevo } = await supabase.from("user_goals").insert({
    user_id: user.id,
    objetivo: objetivo.objetivo,
    peso_meta_kg: objetivo.peso_meta_kg,
    factor_actividad: objetivo.factor_actividad,
    deficit_pct: objetivo.deficit_pct,
    kcal: kcalPropuesto,
    proteina_g: reparto.proteinaG,
    carbs_g: reparto.carbsG,
    grasa_g: reparto.grasaG,
    activo: true,
    motivo: `Ajuste semanal aceptado (${objetivo.kcal} → ${kcalPropuesto} kcal)`,
  });
  if (errNuevo) return { ok: false, error: errNuevo.message };

  revalidatePath("/peso");
  revalidatePath("/perfil");
  revalidatePath("/hoy");

  return {
    ok: true,
    mensaje: `Objetivo actualizado a ${kcalPropuesto} kcal.`,
  };
}
