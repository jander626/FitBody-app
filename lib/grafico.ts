/**
 * Cálculo de la escala del gráfico de peso.
 *
 * Vive aparte del componente porque acá estuvo un error que sólo se ve
 * mirando el gráfico: incluir la meta en el dominio. Con el peso entre 78.4 y
 * 79.4 y la meta en 72, el rango pasa de 1 kg a 7 kg y el progreso real —lo
 * único que el gráfico tiene que mostrar— se aplana hasta desaparecer.
 *
 * La regla: **el dominio sale de los datos, nunca de la meta.**
 */

export interface Dominio {
  y0: number;
  y1: number;
  /** Si la meta cae dentro de la escala y se puede dibujar como línea. */
  metaVisible: boolean;
}

/** Rango mínimo en kg, para que una serie casi plana no parezca una montaña. */
export const RANGO_MINIMO_KG = 1.0;

/** Aire proporcional arriba y abajo de los datos. */
export const MARGEN = 0.15;

export function calcularDominio(
  valores: number[],
  pesoMetaKg: number | null,
): Dominio {
  if (valores.length === 0) {
    return { y0: 0, y1: 1, metaVisible: false };
  }

  const min = Math.min(...valores);
  const max = Math.max(...valores);

  // Primero el aire proporcional…
  const margen = (max - min) * MARGEN;
  let y0 = min - margen;
  let y1 = max + margen;

  // …y solo después el mínimo, sobre el rango total y no sobre el margen.
  // Aplicarlo al margen ensanchaba de más: un descenso real de 1.2 kg quedaba
  // en una escala de 2.2 kg, con los datos ocupando la mitad del alto.
  const rango = y1 - y0;
  if (rango < RANGO_MINIMO_KG) {
    const falta = (RANGO_MINIMO_KG - rango) / 2;
    y0 -= falta;
    y1 += falta;
  }

  return {
    y0,
    y1,
    metaVisible: pesoMetaKg !== null && pesoMetaKg >= y0 && pesoMetaKg <= y1,
  };
}
