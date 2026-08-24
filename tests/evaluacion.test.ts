/**
 * Tests de las métricas de precisión.
 *
 * Definir qué cuenta como "acertar un alimento" es una decisión, no un
 * detalle: es la cifra con la que se va a juzgar si el registro por foto
 * sirve. Estos tests fijan esa definición.
 */
import { describe, expect, it } from "vitest";
import {
  encontrar,
  errorRelativo,
  mediana,
  palabrasClave,
} from "@/lib/evaluacion";

const est = (...nombres: string[]) => nombres.map((alimento) => ({ alimento }));

describe("palabras clave", () => {
  it("descarta las palabras cortas, que no distinguen nada", () => {
    expect([...palabrasClave("pollo con papa a la plancha")]).toEqual([
      "pollo",
      "papa",
      "plancha",
    ]);
  });

  it("ignora acentos y mayúsculas", () => {
    expect(palabrasClave("Plátano Maduro").has("platano")).toBe(true);
  });
});

describe("encontrar un alimento entre los estimados", () => {
  it("el match exacto cuenta como estricto", () => {
    const r = encontrar("Arepa de maiz", est("Huevo entero", "Arepa de maiz"));
    expect(r.estricto).toBe(true);
    expect(r.laxo).toBe(1);
  });

  it("ignora acentos y mayúsculas para el estricto", () => {
    expect(encontrar("arepa de maíz", est("Arepa de Maiz")).estricto).toBe(true);
  });

  it("un nombre distinto del mismo alimento cuenta como laxo", () => {
    // Para registrar calorías, esto ES acertar.
    const r = encontrar("pechuga a la plancha", est("Pechuga de pollo sin piel"));
    expect(r.estricto).toBe(false);
    expect(r.laxo).toBe(0);
  });

  it("un alimento distinto no cuenta", () => {
    const r = encontrar("Arepa de maiz", est("Pechuga de pollo", "Aguacate"));
    expect(r.estricto).toBe(false);
    expect(r.laxo).toBeNull();
  });

  it("las palabras cortas no generan falsos positivos", () => {
    // "con" y "de" están en los dos y no significan que sea el mismo plato.
    const r = encontrar("arroz con pollo", est("sopa de verduras"));
    expect(r.laxo).toBeNull();
  });

  it("el match exacto manda sobre uno laxo anterior", () => {
    // "Arepa de maiz frita" hace match laxo en el índice 0, pero el exacto
    // del índice 1 es el que corresponde medir.
    const r = encontrar(
      "Arepa de maiz",
      est("Arepa de maiz frita", "Arepa de maiz"),
    );
    expect(r.estricto).toBe(true);
    expect(r.laxo).toBe(1);
  });

  it("sin estimaciones no encuentra nada", () => {
    expect(encontrar("Arepa", [])).toEqual({ estricto: false, laxo: null });
  });
});

describe("mediana", () => {
  it("con cantidad impar toma el del medio", () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("con cantidad par promedia los dos centrales", () => {
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("no altera el arreglo original", () => {
    const original = [3, 1, 2];
    mediana(original);
    expect(original).toEqual([3, 1, 2]);
  });

  it("sin datos devuelve null, no NaN ni cero", () => {
    // Un cero acá se leería como "error cero", que es lo contrario de la verdad.
    expect(mediana([])).toBeNull();
  });
});

describe("error relativo", () => {
  it("mide la desviación como fracción del valor real", () => {
    expect(errorRelativo(120, 100)).toBeCloseTo(0.2, 6);
    expect(errorRelativo(80, 100)).toBeCloseTo(0.2, 6);
  });

  it("una estimación exacta da cero", () => {
    expect(errorRelativo(100, 100)).toBe(0);
  });

  it("con un valor real de cero devuelve null en vez de infinito", () => {
    expect(errorRelativo(50, 0)).toBeNull();
  });
});
