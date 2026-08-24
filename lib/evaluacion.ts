/**
 * Métricas de la evaluación de precisión.
 *
 * Acá está la parte con criterio: **qué cuenta como acertar un alimento.** Un
 * número de precisión sin esa definición explícita no significa nada, y como
 * es la cifra que decide si el registro por foto sirve, conviene que sea
 * revisable y esté testeada.
 *
 * Módulo puro, sin I/O.
 */
import { normalizar } from "./texto";

/** Palabras con contenido: las cortas no distinguen nada ("de", "con", "y"). */
export function palabrasClave(texto: string): Set<string> {
  return new Set(
    normalizar(texto)
      .split(" ")
      .filter((p) => p.length >= 4),
  );
}

export interface Coincidencia {
  /** Mismo nombre normalizado. Lo que se puede automatizar sin discusión. */
  estricto: boolean;
  /** Índice del ítem estimado que corresponde, o null si ninguno. */
  laxo: number | null;
}

/**
 * ¿El ítem esperado aparece entre los estimados?
 *
 * Dos niveles, porque la respuesta honesta depende de qué se considere acertar:
 *
 *  - **estricto**: el nombre normalizado coincide exactamente.
 *  - **laxo**: comparten una palabra con contenido. "pechuga a la plancha" vs
 *    "Pechuga de pollo sin piel" cuenta — y para registrar calorías, eso *es*
 *    acertar.
 *
 * Se reportan los dos. Publicar solo el estricto subestima el sistema;
 * publicar solo el laxo lo infla.
 */
export function encontrar(
  esperado: string,
  estimados: { alimento: string }[],
): Coincidencia {
  const objetivo = normalizar(esperado);
  const clavesEsperadas = palabrasClave(esperado);

  let estricto = false;
  let laxo: number | null = null;

  for (const [i, est] of estimados.entries()) {
    if (normalizar(est.alimento) === objetivo) {
      estricto = true;
      // El match exacto manda, aunque uno laxo haya aparecido antes.
      laxo = i;
      break;
    }
    if (laxo === null) {
      const claves = palabrasClave(est.alimento);
      for (const clave of clavesEsperadas) {
        if (claves.has(clave)) {
          laxo = i;
          break;
        }
      }
    }
  }

  return { estricto, laxo };
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0
    ? (orden[medio - 1] + orden[medio]) / 2
    : orden[medio];
}

/** Error relativo, acotado para que un valor real de cero no dé infinito. */
export function errorRelativo(estimado: number, real: number): number | null {
  if (real <= 0) return null;
  return Math.abs(estimado - real) / real;
}
