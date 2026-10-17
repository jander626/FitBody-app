import { describe, expect, it } from "vitest";
import {
  aPor100,
  estaCompleta,
  revisarPor100,
  sanearLectura,
  type EtiquetaCruda,
} from "@/lib/barcode/etiqueta";

const CRUDA: EtiquetaCruda = {
  legible: true,
  nombre: "  Galletas Festival  ",
  base: "porcion",
  tamano_porcion: 30,
  kcal: 140,
  proteina_g: 2,
  carbohidratos_g: 21,
  grasa_g: 5,
};

describe("aPor100", () => {
  it("una porción de 30 g se multiplica por 100/30", () => {
    // 140 kcal en 30 g = 467 kcal por 100 g
    expect(aPor100({ kcal: 140, proteinaG: 2, carbsG: 21, grasaG: 5 }, "porcion", 30)).toEqual({
      kcal100: 467,
      p100: 6.7,
      c100: 70,
      g100: 16.7,
    });
  });

  it("con base 100 g o 100 ml no convierte nada", () => {
    const v = { kcal: 250, proteinaG: 8, carbsG: 30, grasaG: 10 };
    expect(aPor100(v, "100g", null)).toEqual({ kcal100: 250, p100: 8, c100: 30, g100: 10 });
    expect(aPor100(v, "100ml", 999)).toEqual({ kcal100: 250, p100: 8, c100: 30, g100: 10 });
  });

  it("sin un tamaño de porción creíble no inventa el producto", () => {
    const v = { kcal: 140, proteinaG: 2, carbsG: 21, grasaG: 5 };
    expect(aPor100(v, "porcion", null)).toBeNull();
    expect(aPor100(v, "porcion", 0)).toBeNull();
    expect(aPor100(v, "porcion", -5)).toBeNull();
    expect(aPor100(v, "porcion", 5000)).toBeNull();
    expect(aPor100(v, "porcion", Number.NaN)).toBeNull();
  });

  it("una porción de 100 g queda igual que la etiqueta", () => {
    const v = { kcal: 300, proteinaG: 10, carbsG: 40, grasaG: 10 };
    expect(aPor100(v, "porcion", 100)).toEqual({ kcal100: 300, p100: 10, c100: 40, g100: 10 });
  });
});

describe("revisarPor100", () => {
  it("un producto normal pasa sin errores ni avisos", () => {
    expect(revisarPor100({ kcal100: 467, p100: 6.7, c100: 70, g100: 16.7 })).toEqual({ errores: [], avisos: [] });
  });

  it("bloquea lo imposible", () => {
    expect(revisarPor100({ kcal100: 1200, p100: 5, c100: 5, g100: 5 }).errores).toHaveLength(1);
    expect(revisarPor100({ kcal100: 400, p100: 130, c100: 5, g100: 5 }).errores).toHaveLength(1);
    expect(revisarPor100({ kcal100: 400, p100: 50, c100: 50, g100: 50 }).errores[0]).toMatch(/suman más de 100/);
    expect(revisarPor100({ kcal100: -1, p100: 1, c100: 1, g100: 1 }).errores).toHaveLength(1);
  });

  it("avisa, sin bloquear, si las calorías no cuadran con los macros", () => {
    const r = revisarPor100({ kcal100: 120, p100: 10, c100: 40, g100: 20 }); // macros ≈ 380
    expect(r.errores).toEqual([]);
    expect(r.avisos).toHaveLength(1);
  });

  it("tolera el redondeo normal de una etiqueta", () => {
    // Macros ≈ 440; la etiqueta dice 450: bien.
    expect(revisarPor100({ kcal100: 450, p100: 8, c100: 60, g100: 18 }).avisos).toEqual([]);
  });
});

describe("sanearLectura", () => {
  it("recorta el nombre y conserva lo bueno", () => {
    const l = sanearLectura(CRUDA);
    expect(l.nombre).toBe("Galletas Festival");
    expect(l.kcal).toBe(140);
    expect(l.tamano).toBe(30);
  });

  it("descarta números absurdos o negativos en vez de pasarlos al formulario", () => {
    const l = sanearLectura({ ...CRUDA, kcal: -4, proteina_g: Number.NaN, grasa_g: 99999 });
    expect(l.kcal).toBeNull();
    expect(l.proteinaG).toBeNull();
    expect(l.grasaG).toBeNull();
    expect(l.carbsG).toBe(21);
  });

  it("el tamaño de porción solo cuenta cuando la base es porción", () => {
    expect(sanearLectura({ ...CRUDA, base: "100g", tamano_porcion: 30 }).tamano).toBeNull();
  });
});

describe("estaCompleta", () => {
  it("pide los cuatro valores, y el tamaño si es por porción", () => {
    expect(estaCompleta(sanearLectura(CRUDA))).toBe(true);
    expect(estaCompleta(sanearLectura({ ...CRUDA, grasa_g: null }))).toBe(false);
    expect(estaCompleta(sanearLectura({ ...CRUDA, tamano_porcion: null }))).toBe(false);
    expect(estaCompleta(sanearLectura({ ...CRUDA, base: "100g", tamano_porcion: null }))).toBe(true);
  });
});
