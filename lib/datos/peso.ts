import "server-only";

import {
  ajusteSemanal,
  leerComposicion,
  mediaMovil7d,
  ratioCinturaEstatura,
  ritmoEsperado,
  tdee,
  tmb,
  type AjusteSemanal,
  type LecturaComposicion,
  type MedidaCintura,
  type PuntoTendencia,
  type RatioCintura,
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
  /** Medidas de cintura, de la más vieja a la más nueva. */
  cintura: MedidaCintura[];
  cinturaDeHoy: number | null;
  /**
   * Qué dicen la cintura y el peso juntos.
   *
   * No depende del perfil ni del objetivo: son dos series medidas, y se leen
   * igual haya plan o no.
   */
  composicion: LecturaComposicion;
  /**
   * Cintura sobre estatura, de la última medida. Null sin estatura o sin
   * medidas. Es la métrica que el plan de 90 días persigue: 0.50.
   */
  ratio: RatioCintura | null;
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
      .select("fecha, peso_kg, cintura_cm")
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

  const cintura: MedidaCintura[] = (pesosRes.data ?? [])
    .filter((r) => r.cintura_cm !== null)
    .map((r) => ({ fecha: r.fecha, cinturaCm: Number(r.cintura_cm) }));
  const cinturaDeHoy =
    cintura.find((m) => m.fecha === hoy)?.cinturaCm ?? null;
  const composicion = leerComposicion(cintura, serie);

  const ultimaCintura = cintura.at(-1);
  const ratio = ultimaCintura
    ? ratioCinturaEstatura(ultimaCintura.cinturaCm, perfilRes.data?.estatura_cm)
    : null;
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
      cintura,
      cinturaDeHoy,
      composicion,
      ratio,
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
    cintura,
    cinturaDeHoy,
    composicion,
    ratio,
  };
}
