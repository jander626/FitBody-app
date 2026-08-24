import "server-only";

import {
  ajusteSemanal,
  mediaMovil7d,
  ritmoEsperado,
  tdee,
  tmb,
  type AjusteSemanal,
  type PuntoTendencia,
  type Sexo,
} from "@/lib/nutrition";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

export interface EstadoPeso {
  /** Serie con media móvil, ordenada de la más vieja a la más nueva. */
  serie: PuntoTendencia[];
  pesoDeHoy: number | null;
  pesoMetaKg: number | null;
  kcalActual: number | null;
  /** Ritmo esperado según el plan activo, en kg/semana. */
  ritmoEsperadoKgSemana: { min: number; max: number } | null;
  /** Sugerencia de ajuste. Null cuando falta el perfil o el objetivo. */
  ajuste: AjusteSemanal | null;
}

/** Todo lo que necesita la pantalla de peso, en una pasada. */
export async function obtenerEstadoPeso(
  userId: string,
  hoy: string,
): Promise<EstadoPeso> {
  const supabase = await clienteServidor();

  const [pesosRes, objetivoRes, perfilRes] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("fecha, peso_kg")
      .eq("user_id", userId)
      .order("fecha", { ascending: true }),
    supabase
      .from("user_goals")
      .select("kcal, peso_meta_kg, factor_actividad")
      .eq("user_id", userId)
      .eq("activo", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("edad, sexo, estatura_cm")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const registros = (pesosRes.data ?? []).map((r) => ({
    fecha: r.fecha,
    pesoKg: r.peso_kg,
  }));

  const serie = mediaMovil7d(registros);
  const pesoDeHoy = registros.find((r) => r.fecha === hoy)?.pesoKg ?? null;
  const ultimoPeso = registros.at(-1)?.pesoKg ?? null;

  const objetivo = objetivoRes.data;
  const perfil = perfilRes.data;

  // El ritmo esperado depende del gasto, que depende del peso actual. Sin
  // perfil completo no hay contra qué comparar, así que no se inventa nada.
  const puedeComparar =
    objetivo !== null &&
    objetivo !== undefined &&
    perfil?.edad != null &&
    perfil?.sexo != null &&
    perfil?.estatura_cm != null &&
    ultimoPeso !== null;

  if (!puedeComparar) {
    return {
      serie,
      pesoDeHoy,
      pesoMetaKg: objetivo?.peso_meta_kg ?? null,
      kcalActual: objetivo?.kcal ?? null,
      ritmoEsperadoKgSemana: null,
      ajuste: null,
    };
  }

  const sexo = perfil.sexo as Sexo;
  const gasto = tdee(
    tmb({
      sexo,
      edad: perfil.edad!,
      estaturaCm: perfil.estatura_cm!,
      pesoKg: ultimoPeso,
    }),
    objetivo.factor_actividad,
  );

  const esperado = ritmoEsperado(ultimoPeso, gasto, objetivo.kcal);

  return {
    serie,
    pesoDeHoy,
    pesoMetaKg: objetivo.peso_meta_kg,
    kcalActual: objetivo.kcal,
    ritmoEsperadoKgSemana: esperado,
    ajuste: ajusteSemanal(registros, objetivo.kcal, esperado, sexo),
  };
}
