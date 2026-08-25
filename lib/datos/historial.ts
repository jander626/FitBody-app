import "server-only";

import { tdee, tmb, type Sexo } from "@/lib/nutrition";
import { promedios, resumir, type ResumenDia } from "@/lib/historial";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

export interface Historial {
  dias: ResumenDia[];
  objetivo: { kcal: number; proteinaG: number; carbsG: number; grasaG: number } | null;
  /** Gasto diario estimado. La referencia contra la que se mide el déficit. */
  gastoKcal: number | null;
  promedio: ReturnType<typeof promedios>;
}

/**
 * Totales por día de todo el histórico.
 *
 * Se agrega en memoria en vez de con SQL porque son decenas de días, no miles,
 * y así la misma función de clasificación que usa la vista se puede probar sin
 * una base de datos.
 */
export async function obtenerHistorial(userId: string): Promise<Historial> {
  const supabase = await clienteServidor();

  const [comidasRes, objetivoRes, perfilRes, pesoRes] = await Promise.all([
    supabase
      .from("meal_logs")
      .select("fecha, meal_log_items (kcal, proteina_g, carbs_g, grasa_g)")
      .eq("user_id", userId)
      .order("fecha", { ascending: false }),
    supabase
      .from("user_goals")
      .select("kcal, proteina_g, carbs_g, grasa_g, factor_actividad")
      .eq("user_id", userId)
      .eq("activo", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("edad, sexo, estatura_cm")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("weight_logs")
      .select("peso_kg")
      .eq("user_id", userId)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Un día puede tener varias comidas: se suman todas.
  const porFecha = new Map<
    string,
    { kcal: number; proteinaG: number; carbsG: number; grasaG: number; comidas: number }
  >();

  for (const comida of comidasRes.data ?? []) {
    const acc = porFecha.get(comida.fecha) ?? {
      kcal: 0,
      proteinaG: 0,
      carbsG: 0,
      grasaG: 0,
      comidas: 0,
    };
    for (const i of comida.meal_log_items ?? []) {
      acc.kcal += i.kcal;
      acc.proteinaG += i.proteina_g;
      acc.carbsG += i.carbs_g;
      acc.grasaG += i.grasa_g;
    }
    acc.comidas += 1;
    porFecha.set(comida.fecha, acc);
  }

  const crudos = [...porFecha.entries()]
    .map(([fecha, t]) => ({ fecha, ...t }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const objetivo = objetivoRes.data
    ? {
        kcal: objetivoRes.data.kcal,
        proteinaG: objetivoRes.data.proteina_g,
        carbsG: objetivoRes.data.carbs_g,
        grasaG: objetivoRes.data.grasa_g,
      }
    : null;

  const perfil = perfilRes.data;
  const pesoKg = pesoRes.data?.peso_kg;

  // Sin perfil completo no hay gasto contra el cual medir el déficit, así que
  // no se inventa uno: la vista muestra los totales sin clasificar.
  const gastoKcal =
    objetivoRes.data && perfil?.edad != null && perfil.sexo != null &&
    perfil.estatura_cm != null && pesoKg != null
      ? tdee(
          tmb({
            sexo: perfil.sexo as Sexo,
            edad: perfil.edad,
            estaturaCm: perfil.estatura_cm,
            pesoKg,
          }),
          objetivoRes.data.factor_actividad,
        )
      : null;

  const dias =
    objetivo && gastoKcal !== null
      ? resumir(crudos, objetivo, gastoKcal)
      : crudos.map((d) => ({
          ...d,
          estado: "sin_registro" as const,
          pctProteina: 0,
          deficit: 0,
        }));

  return {
    dias,
    objetivo,
    gastoKcal,
    promedio: objetivo && gastoKcal !== null ? promedios(dias) : null,
  };
}
