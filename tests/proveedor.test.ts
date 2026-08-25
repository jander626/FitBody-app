/**
 * Tests de la capa de proveedores.
 *
 * Dos cosas que si se rompen no dan error visible, solo estimaciones peores:
 * la traducción del esquema (el modelo devolvería otra forma) y la elección de
 * proveedor (se llamaría al que no era, y la cuenta llegaría por correo).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aJsonSchema } from "@/lib/vision/esquema-json";
import { RespuestaSchema } from "@/lib/vision/esquema";
import { elegirProveedor } from "@/lib/vision/proveedor";
import { costoUsd, esGratis, PRECIOS_POR_PROVEEDOR } from "@/lib/guardrails/costos";

describe("traducir el esquema para Gemini", () => {
  const esquema = aJsonSchema(RespuestaSchema);

  it("saca las claves que Google rechaza", () => {
    const texto = JSON.stringify(esquema);
    expect(texto).not.toContain("$schema");
    expect(texto).not.toContain("additionalProperties");
  });

  it("colapsa nullable a un type con dos valores", () => {
    // Zod 4 escribe .nullable() como anyOf de dos ramas; Gemini no lo acepta.
    const props = (esquema.properties as Record<string, Record<string, unknown>>)
      .items;
    const item = (props.items as Record<string, unknown>) as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(item.properties.slug.type).toEqual(["string", "null"]);
    expect(item.properties.porcion_g.type).toEqual(["number", "null"]);
    expect(JSON.stringify(esquema)).not.toContain("anyOf");
  });

  it("conserva las descripciones, que son la mitad del prompt", () => {
    const texto = JSON.stringify(esquema);
    expect(texto).toContain("Slug exacto");
    expect(texto).toContain("no es sobre comida");
    expect(texto).toContain("Gramos estimados");
  });

  it("conserva los enums y el tope de preguntas", () => {
    const props = esquema.properties as Record<string, Record<string, unknown>>;
    expect(props.confianza.enum).toEqual(["alta", "media", "baja"]);
    expect(props.preguntas.maxItems).toBe(2);
  });

  it("no toca un esquema que ya estaba limpio", () => {
    const simple = aJsonSchema(z.object({ a: z.number() }));
    expect(simple).toEqual({
      type: "object",
      properties: { a: { type: "number" } },
      required: ["a"],
    });
  });
});

describe("elegir proveedor", () => {
  it("sin ninguna clave no hay proveedor", () => {
    expect(elegirProveedor({})).toBeNull();
  });

  it("con una sola clave se usa esa, sin configurar nada más", () => {
    expect(elegirProveedor({ GEMINI_API_KEY: "x" })?.nombre).toBe("gemini");
    expect(elegirProveedor({ ANTHROPIC_API_KEY: "x" })?.nombre).toBe("anthropic");
  });

  it("acepta GOOGLE_API_KEY, que es como la llama la consola de Google", () => {
    expect(elegirProveedor({ GOOGLE_API_KEY: "x" })?.nombre).toBe("gemini");
  });

  it("FITFOOD_PROVEEDOR manda sobre las claves presentes", () => {
    const r = elegirProveedor({
      ANTHROPIC_API_KEY: "x",
      GEMINI_API_KEY: "y",
      FITFOOD_PROVEEDOR: "gemini",
    });
    expect(r?.nombre).toBe("gemini");
  });

  it("un proveedor inventado falla fuerte en vez de caer en el otro", () => {
    // Un typo acá llamaría al modelo equivocado sin decir nada.
    expect(() => elegirProveedor({ FITFOOD_PROVEEDOR: "openai" })).toThrow(
      /no existe/,
    );
  });
});

describe("costo por proveedor", () => {
  it("el mismo uso cuesta distinto según quién conteste", () => {
    const uso = { entrada: 10_000, salida: 1_000 };
    const conAnthropic = costoUsd(uso, "anthropic");
    const conGemini = costoUsd(uso, "gemini");
    expect(conGemini).toBeLessThan(conAnthropic);
  });

  it("por omisión sigue cobrando como Anthropic", () => {
    // El histórico se guardó sin proveedor: cambiar el default lo reescribiría.
    expect(costoUsd({ entrada: 1_000, salida: 100 })).toBe(
      costoUsd({ entrada: 1_000, salida: 100 }, "anthropic"),
    );
  });

  it("leer del caché es más barato que la entrada normal, en los dos", () => {
    for (const p of ["anthropic", "gemini"] as const) {
      expect(PRECIOS_POR_PROVEEDOR[p].entradaCacheada).toBeLessThan(
        PRECIOS_POR_PROVEEDOR[p].entrada,
      );
    }
  });

  it("la capa gratuita de Gemini no descuenta del tope", () => {
    expect(esGratis("gemini", {})).toBe(true);
    expect(esGratis("anthropic", {})).toBe(false);
  });

  it("con clave paga de Gemini vuelve a contar", () => {
    expect(esGratis("gemini", { FITFOOD_GEMINI_PAGO: "1" })).toBe(false);
  });
});
