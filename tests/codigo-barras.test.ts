import { describe, expect, it } from "vitest";
import { esCodigoValido, parsearProducto } from "@/lib/barcode/openfoodfacts";

const COMPLETO = {
  status: 1,
  product: {
    product_name: "Galletas",
    product_name_es: "Galletas de vainilla",
    brands: "Marca A, Marca B",
    serving_quantity: "30",
    nutriments: {
      "energy-kcal_100g": 460,
      proteins_100g: 5.04,
      carbohydrates_100g: 72,
      fat_100g: "17,3",
    },
  },
};

describe("esCodigoValido", () => {
  it("acepta EAN-8, UPC-A, EAN-13 y GTIN-14", () => {
    for (const c of ["12345678", "123456789012", "7702004003508", "12345678901234"]) {
      expect(esCodigoValido(c)).toBe(true);
    }
  });

  it("rechaza lo que no es un código", () => {
    for (const c of ["", "1234567", "123456789", "77020040035O8", "../etc", "7702004003508 "]) {
      expect(esCodigoValido(c)).toBe(false);
    }
  });
});

describe("parsearProducto", () => {
  it("lee un producto completo, prefiere el nombre en español y la primera marca", () => {
    const r = parsearProducto("7702004003508", COMPLETO);
    expect(r).toEqual({
      estado: "ok",
      origen: "openfoodfacts",
      producto: {
        codigo: "7702004003508",
        nombre: "Galletas de vainilla",
        marca: "Marca A",
        kcal100: 460,
        p100: 5,
        c100: 72,
        g100: 17.3,
        porcionG: 30,
      },
    });
  });

  it("convierte kJ a kcal cuando no hay kcal", () => {
    const r = parsearProducto("7702004003508", {
      status: 1,
      product: {
        product_name: "Algo",
        nutriments: {
          energy_100g: 1000,
          proteins_100g: 1,
          carbohydrates_100g: 1,
          fat_100g: 1,
        },
      },
    });
    expect(r.estado === "ok" && r.producto.kcal100).toBe(239);
  });

  it("no encontrado cuando Open Food Facts no lo tiene", () => {
    expect(parsearProducto("7702004003508", { status: 0 })).toEqual({
      estado: "no_encontrado",
    });
    expect(parsearProducto("7702004003508", null)).toEqual({ estado: "no_encontrado" });
  });

  it("sin nutrición si falta cualquiera de las cuatro cifras, sin inventar ceros", () => {
    const sinGrasa = structuredClone(COMPLETO);
    delete (sinGrasa.product.nutriments as Record<string, unknown>).fat_100g;
    expect(parsearProducto("7702004003508", sinGrasa)).toEqual({
      estado: "sin_nutricion",
      nombre: "Galletas de vainilla",
    });
  });

  it("descarta porciones absurdas y números negativos", () => {
    const raro = structuredClone(COMPLETO);
    raro.product.serving_quantity = "99999";
    const r = parsearProducto("7702004003508", raro);
    expect(r.estado === "ok" && r.producto.porcionG).toBeNull();

    const negativo = structuredClone(COMPLETO);
    (negativo.product.nutriments as Record<string, unknown>).proteins_100g = -3;
    expect(parsearProducto("7702004003508", negativo).estado).toBe("sin_nutricion");
  });
});
