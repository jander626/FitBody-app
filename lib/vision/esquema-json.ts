import { z } from "zod";

/**
 * El esquema de Zod, traducido a lo que aceptan las APIs de salida
 * estructurada que no son Anthropic.
 *
 * La fuente de verdad sigue siendo `RespuestaSchema`: acá no se reescribe el
 * esquema a mano. Si se escribiera dos veces, los dos proveedores se irían
 * separando de a poco y el script de evaluación terminaría comparando dos
 * cosas distintas sin avisar.
 *
 * Lo único que hace esta función es limpiar lo que sobra:
 *
 *  - `$schema` y `additionalProperties`, que Google rechaza.
 *  - `anyOf: [T, null]`, la forma en que Zod 4 escribe `.nullable()`. Se
 *    colapsa a `type: [T, "null"]`, que es la forma que entiende Gemini.
 *
 * La descripción de cada campo sí se conserva: es la mitad del prompt. Sin
 * ella el modelo no sabe qué es un slug ni cuándo dejar la porción en null.
 */

type Nodo = Record<string, unknown>;

const SOBRAN = new Set(["$schema", "additionalProperties", "$id", "$ref", "definitions", "$defs"]);

function limpiar(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(limpiar);
  if (nodo === null || typeof nodo !== "object") return nodo;

  const entrada = nodo as Nodo;

  // `.nullable()` de Zod 4 sale como anyOf de dos ramas, una de ellas null.
  // Gemini no acepta esa forma, pero sí un type con dos valores.
  const anyOf = entrada.anyOf;
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const nulo = anyOf.find(
      (r) => (r as Nodo)?.type === "null",
    );
    const real = anyOf.find((r) => (r as Nodo)?.type !== "null");
    if (nulo && real) {
      const resto = { ...entrada };
      delete resto.anyOf;
      return limpiar({
        ...(real as Nodo),
        ...resto,
        type: [(real as Nodo).type, "null"],
      });
    }
  }

  const salida: Nodo = {};
  for (const [clave, valor] of Object.entries(entrada)) {
    if (SOBRAN.has(clave)) continue;
    salida[clave] = limpiar(valor);
  }
  return salida;
}

/** El esquema listo para mandarle a Gemini. */
export function aJsonSchema(esquema: z.ZodType): Record<string, unknown> {
  return limpiar(z.toJSONSchema(esquema)) as Record<string, unknown>;
}
