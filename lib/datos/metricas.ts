import "server-only";

import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import type { Database } from "@/lib/supabase/tipos-db";
import type { DiaMetrica } from "@/lib/garmin/csv";

type FilaMetrica = Database["public"]["Tables"]["daily_metrics"]["Insert"];

/**
 * Las métricas diarias del reloj.
 *
 * El dato que mueve la aguja es `kcal_totales`: mientras no esté, el gasto se
 * calcula con la fórmula (TMB × factor de actividad), que es una estimación
 * fija. Cuando está, es una medición del día concreto.
 */

export interface MetricaDia {
  fecha: string;
  pasos: number | null;
  suenoHoras: number | null;
  suenoCalidad: string | null;
  fcReposo: number | null;
  bodyBattery: number | null;
  kcalTotales: number | null;
}

export async function obtenerMetricas(
  userId: string,
  desde?: string,
): Promise<MetricaDia[]> {
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("daily_metrics")
    .select(
      "fecha, pasos, sueno_horas, sueno_calidad, fc_reposo, body_battery, kcal_totales",
    )
    .eq("user_id", userId)
    .order("fecha", { ascending: false });

  if (desde) consulta = consulta.gte("fecha", desde);

  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron leer las métricas: ${error.message}`);

  return (data ?? []).map((m) => ({
    fecha: m.fecha,
    pasos: m.pasos,
    suenoHoras: m.sueno_horas === null ? null : Number(m.sueno_horas),
    suenoCalidad: m.sueno_calidad,
    fcReposo: m.fc_reposo,
    bodyBattery: m.body_battery,
    kcalTotales: m.kcal_totales,
  }));
}

/**
 * Guarda los días leídos de los CSV.
 *
 * Es un upsert por (user_id, fecha): reimportar un archivo que se solapa con
 * otro actualiza la fila. Los rangos que exporta Garmin se pisan siempre, así
 * que sin esto la segunda importación duplicaría media quincena.
 *
 * Solo se mandan las columnas que el archivo trae. Mandar el resto en null
 * borraría el sueño al subir el informe de pasos.
 */
export async function guardarMetricas(
  userId: string,
  dias: DiaMetrica[],
): Promise<number> {
  if (dias.length === 0) return 0;

  const supabase = await clienteServidor();

  // Los campos que el archivo no trae van en undefined, y `JSON.stringify` los
  // descarta al serializar: la columna no viaja y el upsert la deja como
  // estaba. Mandarlas en null borraría el sueño al subir el informe de pasos.
  const filas: FilaMetrica[] = dias.map((d) => ({
    user_id: userId,
    fecha: d.fecha,
    fuente: "garmin_csv",
    pasos: d.pasos,
    pasos_objetivo: d.pasosObjetivo,
    sueno_horas: d.suenoHoras,
    sueno_calidad: d.suenoCalidad,
    sueno_puntuacion: d.suenoPuntuacion,
    fc_reposo: d.fcReposo,
    body_battery: d.bodyBattery,
    kcal_activas: d.kcalActivas,
    kcal_totales: d.kcalTotales,
  }));

  const { error } = await supabase
    .from("daily_metrics")
    .upsert(filas, { onConflict: "user_id,fecha" });

  if (error) throw new Error(`No se pudieron guardar las métricas: ${error.message}`);
  return filas.length;
}
