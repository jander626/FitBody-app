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

const MODELO_POR_DEFECTO = "gemini-2.5-flash";

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

function modeloActivo(): string {
  return process.env.FITFOOD_MODELO?.trim() || MODELO_POR_DEFECTO;
}

async function estimar(
  peticion: PeticionEstimacion,
): Promise<ResultadoEstimacion> {
  const ai = obtenerCliente();
  const modelo = modeloActivo();
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
