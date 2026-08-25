import "server-only";

import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { costoUsd, esGratis } from "@/lib/guardrails/costos";
import { aJsonSchema } from "./esquema-json";
import { RespuestaSchema } from "./esquema";
import { contexto, instrucciones, vocabulario } from "./prompt";
import type {
  PeticionEstimacion,
  Proveedor,
  ResultadoEstimacion,
} from "./proveedor";

/**
 * Gemini.
 *
 * Existe por una razón práctica: tiene una capa gratuita, y para una app
 * personal que hace unas diez llamadas por día eso alcanza de sobra.
 *
 * Dos diferencias con Anthropic que valen la pena saber:
 *
 *  - **No hay caché de prompt acá.** La tabla de alimentos —lo más pesado del
 *    prompt— viaja entera en cada turno. Cuando el uso es gratis da igual;
 *    con clave paga, en cambio, cada turno cuesta lo mismo que el primero, y
 *    por eso el precio del proveedor se calcula sin descuento por caché.
 *  - El JSON estructurado se pide con un JSON Schema derivado del **mismo**
 *    `RespuestaSchema`. No hay un segundo esquema escrito a mano: si hubiera
 *    dos, se separarían con el tiempo y las mediciones dejarían de ser
 *    comparables.
 */

/**
 * La cadena de modelos, del preferido al último recurso.
 *
 * No es una lista de repuestos teóricos: medido contra la API el 25/08/2026,
 * `gemini-3.7-flash` contestaba 503 por saturación, y la capa gratuita corta a
 * las **20 peticiones por día y por modelo** (`quotaId
 * GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Con un solo modelo, un
 * día normal de registro se queda sin cuota a media tarde.
 *
 * Como el tope es por modelo, bajar al siguiente cuando uno se agota mantiene
 * la app andando. El efecto de costado es que la capa gratuita rinde varias
 * veces más; el motivo por el que existe es que un 503 no debería dejarte sin
 * poder registrar el almuerzo.
 *
 * El orden **no** es de más nuevo a más viejo: sale de medir los dos primeros
 * contra las mismas 9 comidas de la bitácora (`npm run eval -- --texto`).
 *
 *                        error kcal   bajo 20 %   latencia
 *   gemini-3.5-flash        18 %        5 de 9      7.6 s
 *   gemini-3.6-flash        15 %        7 de 9       21 s
 *
 * Va primero el rápido. Con nueve comidas, tres puntos de error mediano no
 * distinguen a un modelo del otro —la muestra es demasiado chica—, pero
 * catorce segundos de diferencia son ciertos y se sienten en cada registro.
 * Además la tarjeta se confirma a mano: un error de estimación se corrige de
 * un toque, y la espera no.
 *
 * Si algún día se mide con más comidas y 3.6 sigue arriba, se invierte acá o
 * con FITFOOD_MODELO, que además pisa la cadena entera con un solo modelo —
 * que es lo que hace falta para medir uno aislado sin que el respaldo
 * ensucie la medición.
 */
const CADENA = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const;

/** Errores que justifican probar el modelo siguiente. */
function vaAlSiguiente(err: unknown): boolean {
  const codigo = (err as { status?: number })?.status;
  const mensaje = err instanceof Error ? err.message : String(err);
  // 429: se acabó la cuota del día. 503/500: el modelo está saturado.
  return (
    codigo === 429 ||
    codigo === 503 ||
    codigo === 500 ||
    /\b(429|503|500)\b/.test(mensaje) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|high demand/i.test(mensaje)
  );
}

let cliente: GoogleGenAI | null = null;

function obtenerCliente(): GoogleGenAI {
  const clave = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!clave) {
    throw new Error(
      "Falta GEMINI_API_KEY. El registro con IA no funciona sin ella; " +
        "el buscador y el registro manual sí.",
    );
  }
  cliente ??= new GoogleGenAI({ apiKey: clave });
  return cliente;
}

/** Los modelos a probar, en orden. */
export function cadenaDeModelos(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const fijado = env.FITFOOD_MODELO?.trim();
  if (fijado) return fijado.split(",").map((m) => m.trim()).filter(Boolean);
  return [...CADENA];
}

function modeloActivo(): string {
  return cadenaDeModelos()[0];
}

async function estimar(
  peticion: PeticionEstimacion,
): Promise<ResultadoEstimacion> {
  const modelos = cadenaDeModelos();
  let ultimoError: unknown;

  for (const modelo of modelos) {
    try {
      return await estimarCon(modelo, peticion);
    } catch (err) {
      if (!vaAlSiguiente(err)) throw err;
      ultimoError = err;
    }
  }

  throw new Error(
    `Ningún modelo de Gemini pudo responder (probé ${modelos.length}: ` +
      `${modelos.join(", ")}). La capa gratuita corta a las 20 peticiones ` +
      `por día y por modelo, así que puede que se haya agotado la del día. ` +
      `El registro manual sigue funcionando.\n` +
      `Último error: ${ultimoError instanceof Error ? ultimoError.message.slice(0, 200) : ultimoError}`,
  );
}

async function estimarCon(
  modelo: string,
  peticion: PeticionEstimacion,
): Promise<ResultadoEstimacion> {
  const ai = obtenerCliente();
  const arranque = Date.now();

  // El hilo previo. La foto solo va en el turno en que se mandó: reenviarla en
  // cada vuelta multiplicaría el gasto sin agregar información nueva.
  const contenidos: Content[] = [];
  for (const previo of peticion.previos) {
    contenidos.push({
      role: "user",
      parts: [{ text: previo.entradaTexto ?? "(foto)" }],
    });
    contenidos.push({
      role: "model",
      parts: [{ text: JSON.stringify(previo.respuesta) }],
    });
  }

  const partes: Part[] = [];
  if (peticion.fotoBase64 && peticion.fotoMediaType) {
    partes.push({
      inlineData: {
        mimeType: peticion.fotoMediaType,
        data: peticion.fotoBase64,
      },
    });
  }
  partes.push({
    text: peticion.texto?.trim() || "Estimá lo que hay en la foto.",
  });
  contenidos.push({ role: "user", parts: partes });

  const respuesta = await ai.models.generateContent({
    model: modelo,
    contents: contenidos,
    config: {
      systemInstruction: [
        instrucciones(),
        vocabulario(peticion.alimentos),
        contexto({
          objetivo: peticion.objetivo,
          consumidoHoy: peticion.consumidoHoy,
          alimentosFrecuentes: peticion.alimentosFrecuentes,
        }),
      ].join("\n\n"),
      responseMimeType: "application/json",
      responseJsonSchema: aJsonSchema(RespuestaSchema),
      maxOutputTokens: 4000,
    },
  });

  const texto = respuesta.text;
  if (!texto) {
    throw new Error(
      "El modelo no devolvió nada. Probá de nuevo o registrá la comida a mano.",
    );
  }

  // Aunque se haya pedido salida estructurada, el JSON se vuelve a validar
  // contra el esquema. Que el proveedor prometa la forma no es lo mismo que
  // que la cumpla, y más abajo hay código que asume que la cumple.
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new Error(
      "El modelo devolvió algo que no es JSON. Probá de nuevo o registrá la " +
        "comida a mano.",
    );
  }

  const validada = RespuestaSchema.safeParse(crudo);
  if (!validada.success) {
    throw new Error(
      "El modelo no devolvió una estimación con la forma esperada. " +
        "Probá de nuevo o registrá la comida a mano.",
    );
  }

  const uso = respuesta.usageMetadata;
  const cacheadas = uso?.cachedContentTokenCount ?? 0;
  const entrada = (uso?.promptTokenCount ?? 0) - cacheadas;
  // El razonamiento se cobra como salida aunque no aparezca en el texto.
  const salida = (uso?.candidatesTokenCount ?? 0) + (uso?.thoughtsTokenCount ?? 0);

  return {
    respuesta: validada.data,
    tokensIn: Math.max(0, entrada),
    tokensCacheRead: cacheadas,
    tokensOut: salida,
    // En la capa gratuita no se cobra, así que el turno vale cero y no
    // descuenta del tope mensual. Los tokens igual se guardan: son lo que
    // permite ver cuánto costaría si algún día se pasa a clave paga.
    costoUsd: esGratis("gemini")
      ? 0
      : costoUsd(
          { entrada: Math.max(0, entrada), entradaCacheada: cacheadas, salida },
          "gemini",
        ),
    latenciaMs: Date.now() - arranque,
    modelo,
  };
}

export const gemini: Proveedor = {
  nombre: "gemini",
  get modelo() {
    return modeloActivo();
  },
  variableClave: "GEMINI_API_KEY",
  estimar,
};
