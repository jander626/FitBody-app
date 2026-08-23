import "server-only";

import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { calcularPlan, type DatosPersona, type Plan } from "@/lib/nutrition";

export interface Perfil {
  edad: number | null;
  sexo: "hombre" | "mujer" | null;
  estaturaCm: number | null;
  fechaDia1: string | null;
}

export interface Objetivo {
  id: string;
  objetivo: "perder_grasa" | "mantener" | "ganar_musculo";
  pesoMetaKg: number | null;
  factorActividad: number;
  deficitPct: number;
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
}

export interface EstadoPerfil {
  perfil: Perfil;
  objetivo: Objetivo | null;
  pesoActualKg: number | null;
  /**
   * El plan recalculado con los datos de hoy. Null cuando falta algo para
   * calcularlo (perfil incompleto o sin ningún pesaje).
   *
   * Se recalcula en vez de leerse de user_goals a propósito: así la pantalla
   * puede mostrar cuándo el objetivo guardado se quedó viejo respecto al peso
   * actual.
   */
  planRecalculado: Plan | null;
}

/** Lee el perfil, el objetivo activo y el último peso en una sola pasada. */
export async function obtenerEstadoPerfil(
  userId: string,
): Promise<EstadoPerfil> {
  const supabase = await clienteServidor();

  const [perfilRes, objetivoRes, pesoRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("edad, sexo, estatura_cm, fecha_dia_1")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_goals")
      .select(
        "id, objetivo, peso_meta_kg, factor_actividad, deficit_pct, kcal, proteina_g, carbs_g, grasa_g",
      )
      .eq("user_id", userId)
      .eq("activo", true)
      .maybeSingle(),
    supabase
      .from("weight_logs")
      .select("peso_kg")
      .eq("user_id", userId)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const perfil: Perfil = {
    edad: perfilRes.data?.edad ?? null,
    sexo: (perfilRes.data?.sexo as "hombre" | "mujer" | null) ?? null,
    estaturaCm: perfilRes.data?.estatura_cm ?? null,
    fechaDia1: perfilRes.data?.fecha_dia_1 ?? null,
  };

  const objetivo: Objetivo | null = objetivoRes.data
    ? {
        id: objetivoRes.data.id,
        objetivo: objetivoRes.data.objetivo as Objetivo["objetivo"],
        pesoMetaKg: objetivoRes.data.peso_meta_kg,
        factorActividad: objetivoRes.data.factor_actividad,
        deficitPct: objetivoRes.data.deficit_pct,
        kcal: objetivoRes.data.kcal,
        proteinaG: objetivoRes.data.proteina_g,
        carbsG: objetivoRes.data.carbs_g,
        grasaG: objetivoRes.data.grasa_g,
      }
    : null;

  const pesoActualKg = pesoRes.data?.peso_kg ?? null;

  const completo =
    perfil.edad !== null &&
    perfil.sexo !== null &&
    perfil.estaturaCm !== null &&
    pesoActualKg !== null &&
    objetivo !== null;

  const planRecalculado = completo
    ? calcularPlan(
        {
          sexo: perfil.sexo!,
          edad: perfil.edad!,
          estaturaCm: perfil.estaturaCm!,
          pesoKg: pesoActualKg!,
        } satisfies DatosPersona,
        objetivo!.factorActividad,
        objetivo!.objetivo,
        objetivo!.deficitPct,
      )
    : null;

  return { perfil, objetivo, pesoActualKg, planRecalculado };
}

/** Gasto de API del mes en curso, en dólares. */
export async function gastoDelMes(userId: string): Promise<number> {
  const supabase = await clienteServidor();
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("scan_turns")
    .select("costo_usd")
    .eq("user_id", userId)
    .gte("creado_en", inicioMes.toISOString());

  return (data ?? []).reduce((total, t) => total + t.costo_usd, 0);
}
