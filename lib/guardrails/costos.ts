/**
 * Costo de una llamada, para que el gasto sea un número visible.
 *
 * Los precios son los publicados de cada API, en dólares por millón de tokens.
 * Se congelan en cada turno al guardarlo (`scan_turns.costo_usd`), así que
 * cambiar estos valores no reescribe el histórico.
 *
 * La capa gratuita de Gemini no cuesta nada, y aun así los precios de Gemini
 * están acá: si algún día se pasa a clave paga, el tope mensual tiene que
 * seguir midiendo algo real en vez de sumar ceros para siempre.
 */
import type { NombreProveedor } from "@/lib/vision/proveedor";

/** USD por millón de tokens. */
export interface Precios {
  entrada: number;
  /** Leer del caché cuesta una fracción. */
  entradaCacheada: number;
  /** Escribir el caché cuesta algo más que la entrada normal. */
  escrituraCache: number;
  salida: number;
}

export const PRECIOS_POR_PROVEEDOR: Record<NombreProveedor, Precios> = {
  anthropic: {
    entrada: 5.0,
    entradaCacheada: 0.5,
    escrituraCache: 6.25,
    salida: 25.0,
  },
  // Gemini Flash. En la capa gratuita el cobro es cero; estos son los precios
  // de la capa paga, que es a lo que se pasaría si el uso creciera.
  gemini: {
    entrada: 0.3,
    entradaCacheada: 0.075,
    escrituraCache: 0.3833,
    salida: 2.5,
  },
};

/** Compatibilidad: los precios de Anthropic, que fueron los primeros. */
export const PRECIOS = PRECIOS_POR_PROVEEDOR.anthropic;

export interface UsoTokens {
  entrada: number;
  entradaCacheada?: number;
  escrituraCache?: number;
  salida: number;
}

/** Costo de un turno en dólares. */
export function costoUsd(
  uso: UsoTokens,
  proveedor: NombreProveedor = "anthropic",
): number {
  const precios = PRECIOS_POR_PROVEEDOR[proveedor];
  const total =
    (uso.entrada * precios.entrada +
      (uso.entradaCacheada ?? 0) * precios.entradaCacheada +
      (uso.escrituraCache ?? 0) * precios.escrituraCache +
      uso.salida * precios.salida) /
    1_000_000;

  // Seis decimales: un turno barato cuesta centésimas de centavo, y redondear
  // antes de sumar el mes perdería el total.
  return Math.round(total * 1_000_000) / 1_000_000;
}

/**
 * Si el proveedor activo cobra o no.
 *
 * La capa gratuita de Gemini no descuenta del tope mensual, pero eso no
 * significa que no tenga límite: tiene un tope de peticiones por día, que es
 * otra cosa y se controla con los guardrails de sesiones.
 */
export function esGratis(
  proveedor: NombreProveedor,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return proveedor === "gemini" && env.FITFOOD_GEMINI_PAGO !== "1";
}
