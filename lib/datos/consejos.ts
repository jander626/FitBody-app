import "server-only";

import {
  VENTANA_DIAS,
  generarConsejos,
  ultimos,
  type Consejo,
} from "@/lib/coach/consejos";
import { haceDias } from "@/lib/racha";
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
  const hoy = await fechaDeHoy();
  // Las reglas miran VENTANA_DIAS hacia atrás. Traer toda la historia para
  // eso era lo más lento de abrir Hoy, y crece con cada día que se registra:
  // se pide solo lo que se va a usar, con unos días de margen.
  const desde = haceDias(hoy, VENTANA_DIAS + 6);

  const [historial, metricas] = await Promise.all([
    obtenerHistorial(userId, desde),
    obtenerMetricas(userId, desde),
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
