import type { Alimento } from "@/lib/alimentos";
import type { Respuesta } from "./esquema";

/**
 * El contrato que cumple cualquier modelo que estime comidas.
 *
 * La app no sabe quién le contesta. El prompt, el esquema de respuesta, la
 * normalización contra la tabla de alimentos y los guardrails son los mismos
 * para todos: lo único que cambia es quién recibe el prompt y cómo devuelve
 * el JSON.
 *
 * Esto existe por dos razones concretas:
 *
 *  1. Poder usar un modelo gratuito sin reescribir la app.
 *  2. Poder **comparar** modelos con el mismo script de evaluación. Si cada
 *     proveedor tuviera su propio prompt o su propio esquema, medirlos daría
 *     números que no se pueden poner uno al lado del otro.
 */

/** Un turno previo de la conversación, para reconstruir el hilo. */
export interface TurnoPrevio {
  entradaTexto: string | null;
  respuesta: unknown;
}

export type MediaType = "image/jpeg" | "image/png" | "image/webp";

export interface PeticionEstimacion {
  alimentos: Alimento[];
  texto: string | null;
  /** JPEG en base64, sin el prefijo data:. */
  fotoBase64: string | null;
  fotoMediaType: MediaType | null;
  previos: TurnoPrevio[];
  objetivo: {
    kcal: number;
    proteinaG: number;
    carbsG: number;
    grasaG: number;
  } | null;
  consumidoHoy: {
    kcal: number;
    proteinaG: number;
    carbsG: number;
    grasaG: number;
  } | null;
  alimentosFrecuentes: string[];
}

export interface ResultadoEstimacion {
  respuesta: Respuesta;
  tokensIn: number;
  tokensCacheRead: number;
  tokensOut: number;
  costoUsd: number;
  latenciaMs: number;
  /** Qué modelo contestó de verdad. Se guarda en cada turno. */
  modelo: string;
}

export interface Proveedor {
  /** Identificador corto, el que va en FITFOOD_PROVEEDOR. */
  readonly nombre: NombreProveedor;
  /** Modelo por defecto, si no se pisa con FITFOOD_MODELO. */
  readonly modelo: string;
  /** Variable de entorno con la clave. */
  readonly variableClave: string;
  estimar(peticion: PeticionEstimacion): Promise<ResultadoEstimacion>;
}

export const NOMBRES = ["anthropic", "gemini"] as const;
export type NombreProveedor = (typeof NOMBRES)[number];

export function esNombreProveedor(v: string): v is NombreProveedor {
  return (NOMBRES as readonly string[]).includes(v);
}

/**
 * Cuál proveedor usar.
 *
 * Si `FITFOOD_PROVEEDOR` está puesto, manda esa. Si no, se elige por la clave
 * que exista: así, poner `GEMINI_API_KEY` y nada más ya alcanza para que la
 * app funcione, sin tener que acordarse de una segunda variable.
 *
 * Cuando están las dos claves y ninguna preferencia, gana Anthropic por ser lo
 * que se midió primero — pero se avisa, porque tener las dos y no elegir es
 * casi siempre un descuido.
 */
export function elegirProveedor(env: Record<string, string | undefined>): {
  nombre: NombreProveedor;
  motivo: string;
} | null {
  const pedido = env.FITFOOD_PROVEEDOR?.trim().toLowerCase();

  if (pedido) {
    if (!esNombreProveedor(pedido)) {
      throw new Error(
        `FITFOOD_PROVEEDOR="${pedido}" no existe. Los valores válidos son: ${NOMBRES.join(", ")}.`,
      );
    }
    return { nombre: pedido, motivo: "elegido en FITFOOD_PROVEEDOR" };
  }

  const conAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const conGemini = Boolean(env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY);

  if (conAnthropic && conGemini) {
    return {
      nombre: "anthropic",
      motivo:
        "están las dos claves y no hay FITFOOD_PROVEEDOR: se usa Anthropic",
    };
  }
  if (conAnthropic) return { nombre: "anthropic", motivo: "es la única clave" };
  if (conGemini) return { nombre: "gemini", motivo: "es la única clave" };

  return null;
}
