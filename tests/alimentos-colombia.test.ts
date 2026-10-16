/**
 * Guarda de la semilla de alimentos colombianos.
 *
 * Son números escritos a mano, y un dedo que se resbala (un 28 por un 2.8)
 * llegaría a todos los usuarios como si fuera dato. Esto no verifica que cada
 * valor sea cierto —eso es revisión contra la tabla del ICBF—, pero atrapa lo
 * que es imposible: slugs repetidos, macros que no suman las kcal, porciones
 * absurdas.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("supabase/migrations/0005_alimentos_colombia.sql", "utf8");

interface Fila {
  slug: string;
  nombre: string;
  categoria: string;
  kcal: number;
  p: number;
  c: number;
  g: number;
  porcion: number;
}

const filas: Fila[] = [
  ...SQL.matchAll(
    /^\s+\('([^']+)', '((?:[^']|'')+)', '([^']+)', ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), '(?:[^']|'')*'\)/gm,
  ),
].map((m) => ({
  slug: m[1],
  nombre: m[2],
  categoria: m[3],
  kcal: Number(m[4]),
  p: Number(m[5]),
  c: Number(m[6]),
  g: Number(m[7]),
  porcion: Number(m[8]),
}));

describe("semilla de alimentos de Colombia", () => {
  it("se leyeron todas las filas", () => {
    const valores = SQL.match(/^\s+\('/gm)?.length ?? 0;
    expect(filas.length).toBe(valores);
    expect(filas.length).toBeGreaterThan(80);
  });

  it("no repite slugs", () => {
    expect(new Set(filas.map((f) => f.slug)).size).toBe(filas.length);
  });

  it("las kcal cuadran con los macros (Atwater) salvo alcohol", () => {
    const fuera = filas
      .filter((f) => f.slug !== "aguardiente")
      .map((f) => ({ f, atwater: 4 * f.p + 4 * f.c + 9 * f.g }))
      .filter(({ f, atwater }) => Math.abs(f.kcal - atwater) > Math.max(25, f.kcal * 0.15))
      .map(({ f, atwater }) => `${f.nombre}: ${f.kcal} kcal vs ${Math.round(atwater)} por macros`);
    expect(fuera).toEqual([]);
  });

  it("los macros por 100 g no pasan de 100 g y las porciones son razonables", () => {
    for (const f of filas) {
      expect(f.p + f.c + f.g, f.nombre).toBeLessThanOrEqual(100);
      expect(f.kcal, f.nombre).toBeLessThanOrEqual(900);
      expect(f.porcion, f.nombre).toBeGreaterThan(0);
      expect(f.porcion, f.nombre).toBeLessThanOrEqual(800);
    }
  });
});
