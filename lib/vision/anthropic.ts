import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { costoUsd } from "@/lib/guardrails/costos";
import { RespuestaSchema } from "./esquema";
import { contexto, instrucciones, vocabulario } from "./prompt";
import type {
  PeticionEstimacion,
  Proveedor,
  ResultadoEstimacion,
} from "./proveedor";

/**
 * Anthropic.
 *
 * El prompt está armado para que el prefijo —instrucciones + tabla de
 * alimentos— sea idéntico en todos los turnos y se lea del caché. Es lo más
 * pesado del prompt y lo que menos cambia, así que a partir del segundo turno
 * de cada sesión cuesta una décima parte.
 */

const MODELO_POR_DEFECTO = "claude-opus-5";

let cliente: Anthropic | null = null;

function obtenerCliente(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. El registro con IA no funciona sin ella; " +
        "el buscador y el registro manual sí.",
    );
  }
  cliente ??= new Anthropic();
  return cliente;
}

function modeloActivo(): string {
  return process.env.FITFOOD_MODELO?.trim() || MODELO_POR_DEFECTO;
}

async function estimar(
  peticion: PeticionEstimacion,
): Promise<ResultadoEstimacion> {
  const anthropic = obtenerCliente();
  const modelo = modeloActivo();
  const arranque = Date.now();

  // Reconstrucción del hilo. El texto de la persona y el JSON que devolvió el
  // modelo alcanzan: la foto solo va en el turno en que se mandó, porque
  // reenviarla en cada vuelta multiplicaría el costo sin agregar nada.
  const mensajes: Anthropic.MessageParam[] = [];
  for (const previo of peticion.previos) {
    mensajes.push({
      role: "user",
      content: previo.entradaTexto ?? "(foto)",
    });
    mensajes.push({
      role: "assistant",
      content: JSON.stringify(previo.respuesta),
    });
  }

  const contenido: Anthropic.ContentBlockParam[] = [];
  if (peticion.fotoBase64 && peticion.fotoMediaType) {
    contenido.push({
      type: "image",
      source: {
        type: "base64",
        media_type: peticion.fotoMediaType,
        data: peticion.fotoBase64,
      },
    });
  }
  contenido.push({
    type: "text",
    text: peticion.texto?.trim() || "Estimá lo que hay en la foto.",
  });
  mensajes.push({ role: "user", content: contenido });

  const respuesta = await anthropic.messages.parse({
    model: modelo,
    max_tokens: 4000,
    system: [
      { type: "text", text: instrucciones() },
      {
        type: "text",
        text: vocabulario(peticion.alimentos),
        // El corte del caché va acá: todo lo de arriba es idéntico entre
        // turnos. Lo que cambia (objetivo del día, frecuentes) va después.
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: contexto({
          objetivo: peticion.objetivo,
          consumidoHoy: peticion.consumidoHoy,
          alimentosFrecuentes: peticion.alimentosFrecuentes,
        }),
      },
    ],
    messages: mensajes,
    thinking: { type: "adaptive" },
    output_config: {
      format: zodOutputFormat(RespuestaSchema),
      effort: "medium",
    },
  });

  if (!respuesta.parsed_output) {
    throw new Error(
      "El modelo no devolvió una estimación con la forma esperada. " +
        "Probá de nuevo o registrá la comida a mano.",
    );
  }

  const uso = respuesta.usage;
  const tokensIn = uso.input_tokens ?? 0;
  const tokensCacheRead = uso.cache_read_input_tokens ?? 0;
  const tokensCacheWrite = uso.cache_creation_input_tokens ?? 0;
  const tokensOut = uso.output_tokens ?? 0;

  return {
    respuesta: respuesta.parsed_output,
    tokensIn,
    tokensCacheRead,
    tokensOut,
    costoUsd: costoUsd(
      {
        entrada: tokensIn,
        entradaCacheada: tokensCacheRead,
        escrituraCache: tokensCacheWrite,
        salida: tokensOut,
      },
      "anthropic",
    ),
    latenciaMs: Date.now() - arranque,
    modelo,
  };
}

export const anthropic: Proveedor = {
  nombre: "anthropic",
  get modelo() {
    return modeloActivo();
  },
  variableClave: "ANTHROPIC_API_KEY",
  estimar,
};
