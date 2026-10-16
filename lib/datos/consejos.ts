import "server-only";

import {
  VENTANA_DIAS,
  generarConsejos,
  ultimos,
  type Consejo,
} from "@/lib/coach/consejos";
import { fechaDeHoy } from "./diario";
import { obtenerHistorial } from "./historial";
import { obtenerMetricas } from "./metricas";

export interface EstadoConsejos {
  consejos: Consejo[];
  /** Cuántos días con registro entraron en el análisis. */
  diasAnalizados: number;
  hayObjetivo: boolean;
}

/**
 * Los consejos de la semana.
 *
 * Es una capa fina a propósito: `obtenerHistorial` ya devuelve exactamente las
 * columnas que la regla necesita —el déficit por día, si el gasto lo midió el
 * reloj— y `obtenerMetricas` los pasos y el sueño. Lo único que pasa acá es
 * juntarlos; toda la decisión de qué decir vive en `lib/coach/consejos`, que es
 * puro y está testeado.
 */
export async function obtenerConsejos(userId: string): Promise<EstadoConsejos> {
  const [hoy, historial, metricas] = await Promise.all([
    fechaDeHoy(),
    obtenerHistorial(userId),
    obtenerMetricas(userId),
  ]);

  const consejos = generarConsejos({
    hoy,
    dias: historial.dias,
    metricas,
    objetivo: historial.objetivo
      ? {
          kcal: historial.objetivo.kcal,
          proteinaG: historial.objetivo.proteinaG,
        }
      : null,
    gastoEstimado: historial.gastoKcal,
  });

  return {
    consejos,
    diasAnalizados: ultimos(historial.dias, VENTANA_DIAS, hoy).filter(
      (d) => d.comidas > 0,
    ).length,
    hayObjetivo: historial.objetivo !== null,
  };
}
