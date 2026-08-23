/**
 * Costo de una llamada, para que el gasto sea un número visible.
 *
 * Los precios son los publicados de la API de Anthropic, en dólares por millón
 * de tokens. Se congelan en cada turno al guardarlo (`scan_turns.costo_usd`),
 * así que cambiar estos valores no reescribe el histórico.
 */

export const MODELO = "claude-opus-5";

/** USD por millón de tokens. */
export const PRECIOS = {
  entrada: 5.0,
  /** Leer del caché cuesta una fracción: por eso la tabla va en el prefijo. */
  entradaCacheada: 0.5,
  /** Escribir el caché cuesta algo más que la entrada normal. */
  escrituraCache: 6.25,
  salida: 25.0,
} as const;

export interface UsoTokens {
  entrada: number;
  entradaCacheada?: number;
  escrituraCache?: number;
  salida: number;
}

/** Costo de un turno en dólares. */
export function costoUsd(uso: UsoTokens): number {
  const total =
    (uso.entrada * PRECIOS.entrada +
      (uso.entradaCacheada ?? 0) * PRECIOS.entradaCacheada +
      (uso.escrituraCache ?? 0) * PRECIOS.escrituraCache +
      uso.salida * PRECIOS.salida) /
    1_000_000;

  // Seis decimales: un turno barato cuesta centésimas de centavo, y redondear
  // antes de sumar el mes perdería el total.
  return Math.round(total * 1_000_000) / 1_000_000;
}
