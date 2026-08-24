import { describe, expect, it } from "vitest";
import { calcularDominio, RANGO_MINIMO_KG } from "@/lib/grafico";

/** Los pesos reales de la bitácora, del 11 al 23 de agosto. */
const REALES = [79.4, 78.9, 78.7, 78.5, 78.6, 78.4, 78.3, 78.5, 78.4, 78.2, 78.5, 78.4];

describe("dominio del gráfico de peso", () => {
  it("la meta lejana NO estira la escala", () => {
    // Este es el bug que se encontró mirando el gráfico: con la meta en 72 el
    // dominio pasaba de ~1 kg a ~7 kg y el descenso real desaparecía.
    const conMeta = calcularDominio(REALES, 72);
    const sinMeta = calcularDominio(REALES, null);

    expect(conMeta.y0).toBe(sinMeta.y0);
    expect(conMeta.y1).toBe(sinMeta.y1);
    expect(conMeta.metaVisible).toBe(false);
  });

  it("el rango se mantiene cerca de los datos, no de la meta", () => {
    const { y0, y1 } = calcularDominio(REALES, 72);
    // Los datos abarcan 1.2 kg; la escala no debería pasar de ~2.
    expect(y1 - y0).toBeLessThan(2);
    expect(y0).toBeGreaterThan(77);
  });

  it("una meta dentro del rango sí se dibuja", () => {
    const { metaVisible } = calcularDominio(REALES, 78.5);
    expect(metaVisible).toBe(true);
  });

  it("da un rango mínimo para que una serie plana no parezca una montaña", () => {
    const planos = [78.4, 78.4, 78.4];
    const { y0, y1 } = calcularDominio(planos, null);
    expect(y1 - y0).toBeGreaterThanOrEqual(RANGO_MINIMO_KG);
  });

  it("deja aire arriba y abajo: ningún punto toca el borde", () => {
    const { y0, y1 } = calcularDominio(REALES, null);
    expect(y0).toBeLessThan(Math.min(...REALES));
    expect(y1).toBeGreaterThan(Math.max(...REALES));
  });

  it("sin datos no rompe ni divide por cero", () => {
    const d = calcularDominio([], 72);
    expect(d.y1).toBeGreaterThan(d.y0);
    expect(d.metaVisible).toBe(false);
  });

  it("una meta por encima del peso también queda fuera si está lejos", () => {
    // Caso de ganar músculo: la meta está arriba, no abajo.
    const { metaVisible } = calcularDominio(REALES, 88);
    expect(metaVisible).toBe(false);
  });
});
