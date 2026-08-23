/**
 * Tests de la normalización contra la tabla.
 *
 * Es la pieza que decide de dónde salen los números que terminan en el diario,
 * así que conviene que no se pueda romper sin que algo grite.
 */
import { describe, expect, it } from "vitest";
import type { Alimento } from "@/lib/alimentos";
import { normalizarEstimacion } from "@/lib/vision/normalizar";
import type { ItemEstimado } from "@/lib/vision/esquema";

const TABLA: Alimento[] = [
  {
    id: "id-arepa",
    slug: "arepa-de-maiz-media-tela",
    nombre: "Arepa de maiz (media tela)",
    categoria: "Carbohidrato / tuberculo",
    kcal100: 200,
    p100: 4,
    c100: 42,
    g100: 2,
    porcionG: 50,
    porcionNota: null,
  },
  {
    id: "id-pollo",
    slug: "pechuga-de-pollo-sin-piel",
    nombre: "Pechuga de pollo sin piel",
    categoria: "Proteina animal",
    kcal100: 165,
    p100: 31,
    c100: 0,
    g100: 3.6,
    porcionG: 200,
    porcionNota: null,
  },
];

function estimado(parcial: Partial<ItemEstimado>): ItemEstimado {
  return {
    slug: null,
    alimento: "algo",
    porcion_g: null,
    porcion_ml: null,
    kcal: 0,
    proteina_g: 0,
    carbs_g: 0,
    grasa_g: 0,
    ...parcial,
  };
}

describe("la tabla pone los números", () => {
  it("recalcula los macros cuando el ítem hace match por slug", () => {
    // El modelo estima mal los macros a propósito: deben descartarse.
    const { items } = normalizarEstimacion(
      [
        estimado({
          slug: "arepa-de-maiz-media-tela",
          alimento: "arepa",
          porcion_g: 50,
          kcal: 999,
          proteina_g: 99,
          carbs_g: 99,
          grasa_g: 99,
        }),
      ],
      TABLA,
    );

    expect(items[0]).toEqual({
      foodId: "id-arepa",
      alimento: "Arepa de maiz (media tela)",
      porcionG: 50,
      porcionMl: null,
      kcal: 100,
      proteinaG: 2,
      carbsG: 21,
      grasaG: 1,
      nota: null,
    });
  });

  it("escala con la porción que estimó el modelo", () => {
    const { items } = normalizarEstimacion(
      [estimado({ slug: "pechuga-de-pollo-sin-piel", porcion_g: 150, kcal: 1 })],
      TABLA,
    );
    expect(items[0].kcal).toBe(247.5);
    expect(items[0].proteinaG).toBe(46.5);
  });

  it("cae al nombre cuando el slug no existe", () => {
    // El modelo a veces inventa un slug plausible pero equivocado.
    const { items, enlazados } = normalizarEstimacion(
      [
        estimado({
          slug: "arepa-inventada-xyz",
          alimento: "Arepa de maíz (media tela)",
          porcion_g: 50,
          kcal: 999,
        }),
      ],
      TABLA,
    );
    expect(items[0].foodId).toBe("id-arepa");
    expect(items[0].kcal).toBe(100);
    expect(enlazados).toBe(1);
  });
});

describe("cuando la tabla no alcanza", () => {
  it("el texto libre conserva la estimación del modelo", () => {
    const { items, enlazados } = normalizarEstimacion(
      [
        estimado({
          slug: null,
          alimento: "sancocho de la abuela",
          porcion_g: 350,
          kcal: 420,
          proteina_g: 25,
          carbs_g: 40,
          grasa_g: 15,
        }),
      ],
      TABLA,
    );

    expect(items[0].foodId).toBeNull();
    expect(items[0].alimento).toBe("sancocho de la abuela");
    expect(items[0].kcal).toBe(420);
    expect(enlazados).toBe(0);
  });

  it("con match pero sin gramos, no se puede recalcular: se respeta al modelo", () => {
    // "3 huevos" lleva la cantidad en el nombre, no en una porción.
    const { items, enlazados } = normalizarEstimacion(
      [
        estimado({
          slug: "pechuga-de-pollo-sin-piel",
          alimento: "pechuga a la plancha",
          porcion_g: null,
          kcal: 300,
          proteina_g: 55,
        }),
      ],
      TABLA,
    );

    expect(items[0].foodId).toBe("id-pollo");
    expect(items[0].kcal).toBe(300);
    expect(enlazados).toBe(1);
  });
});

describe("saneamiento de porciones", () => {
  it("nunca deja gramos y mililitros a la vez", () => {
    // La restricción de la tabla lo prohíbe, y el modelo a veces manda los dos.
    const { items } = normalizarEstimacion(
      [estimado({ alimento: "jugo", porcion_g: 240, porcion_ml: 240, kcal: 110 })],
      TABLA,
    );
    expect(items[0].porcionG).toBe(240);
    expect(items[0].porcionMl).toBeNull();
  });

  it("descarta porciones de cero o negativas", () => {
    const { items } = normalizarEstimacion(
      [estimado({ alimento: "agua", porcion_g: 0, kcal: 0 })],
      TABLA,
    );
    expect(items[0].porcionG).toBeNull();
    expect(items[0].porcionMl).toBeNull();
  });

  it("los líquidos conservan sus mililitros", () => {
    const { items } = normalizarEstimacion(
      [estimado({ alimento: "milo con leche", porcion_ml: 200, kcal: 90 })],
      TABLA,
    );
    expect(items[0].porcionMl).toBe(200);
    expect(items[0].porcionG).toBeNull();
  });

  it("no deja macros negativos", () => {
    const { items } = normalizarEstimacion(
      [estimado({ alimento: "raro", kcal: -50, proteina_g: -3 })],
      TABLA,
    );
    expect(items[0].kcal).toBe(0);
    expect(items[0].proteinaG).toBe(0);
  });

  it("una lista vacía no rompe nada", () => {
    expect(normalizarEstimacion([], TABLA)).toEqual({ items: [], enlazados: 0 });
  });
});
