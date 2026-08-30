/**
 * Tests de cambiar la porción de un ítem.
 *
 * El caso que da nombre a todo esto: un jugo de naranja de 250 ml, enlazado a
 * la tabla. Al mover la porción, el editor escribía los gramos y dejaba los
 * mililitros puestos. El ítem quedaba inválido y el campo se sentía trabado
 * porque la vista muestra los ml, que nunca cambiaban.
 */
import { describe, expect, it } from "vitest";
import { recalcularPorcion, type EnTabla } from "@/lib/registro/porcion";
import type { ItemBorrador } from "@/lib/registro/tipos";

const JUGO: EnTabla = { kcal100: 45, p100: 0.7, c100: 10.4, g100: 0.2 };
const POLLO: EnTabla = { kcal100: 165, p100: 31, c100: 0, g100: 3.6 };

function item(cambios: Partial<ItemBorrador> = {}): ItemBorrador {
  return {
    foodId: null,
    alimento: "Algo",
    porcionG: 100,
    porcionMl: null,
    kcal: 200,
    proteinaG: 10,
    carbsG: 20,
    grasaG: 8,
    nota: null,
    ...cambios,
  };
}

describe("la invariante: nunca las dos unidades a la vez", () => {
  it("un ítem en ml sigue en ml, sin gramos", () => {
    // El bug exacto que se reportó.
    const jugo = item({
      alimento: "Jugo de naranja natural",
      foodId: "11111111-1111-4111-8111-111111111111",
      porcionG: null,
      porcionMl: 250,
      kcal: 112,
    });
    const r = recalcularPorcion(jugo, 300, JUGO);
    expect(r.porcionMl).toBe(300);
    expect(r.porcionG).toBeNull();
  });

  it("un ítem en gramos sigue en gramos, sin ml", () => {
    const r = recalcularPorcion(item({ porcionG: 100, porcionMl: null }), 150);
    expect(r.porcionG).toBe(150);
    expect(r.porcionMl).toBeNull();
  });

  it("sin ninguna porción previa se asume gramos", () => {
    const r = recalcularPorcion(item({ porcionG: null, porcionMl: null }), 80);
    expect(r.porcionG).toBe(80);
    expect(r.porcionMl).toBeNull();
  });

  it.each([
    ["en ml", { porcionG: null, porcionMl: 250 }],
    ["en gramos", { porcionG: 100, porcionMl: null }],
    ["sin porción", { porcionG: null, porcionMl: null }],
  ])("%s, jamás quedan las dos", (_, porciones) => {
    const r = recalcularPorcion(item(porciones), 200, POLLO);
    expect(r.porcionG === null || r.porcionMl === null).toBe(true);
  });
});

describe("de dónde salen los macros", () => {
  it("con gramos y tabla, los recalcula desde la tabla", () => {
    const pechuga = item({
      foodId: "22222222-2222-4222-8222-222222222222",
      porcionG: 100,
    });
    const r = recalcularPorcion(pechuga, 200, POLLO);
    expect(r.kcal).toBe(330);
    expect(r.proteinaG).toBe(62);
    expect(r.grasaG).toBe(7.2);
  });

  it("con ml NO usa la tabla: escala lo que había", () => {
    // La tabla es por 100 g. Usarla con ml daría por hecho densidad 1, que para
    // un aceite es falso. Escalar sale bien sea cual sea la densidad.
    const jugo = item({
      foodId: "11111111-1111-4111-8111-111111111111",
      porcionG: null,
      porcionMl: 250,
      kcal: 112,
      proteinaG: 1.8,
      carbsG: 26,
      grasaG: 0.5,
    });
    const r = recalcularPorcion(jugo, 500, JUGO);
    expect(r.kcal).toBe(224);
    expect(r.carbsG).toBe(52);
    // Si hubiera usado la tabla daría 45*5 = 225: parecido, y por la razón
    // equivocada. Con un aceite la diferencia sería del 8 %.
    expect(r.kcal).not.toBe(225);
  });

  it("texto libre en gramos se escala proporcionalmente", () => {
    const r = recalcularPorcion(item({ porcionG: 100, kcal: 200 }), 50);
    expect(r.kcal).toBe(100);
    expect(r.proteinaG).toBe(5);
  });

  it("sin porción previa no inventa macros nuevos", () => {
    const sinPorcion = item({ porcionG: null, porcionMl: null, kcal: 200 });
    const r = recalcularPorcion(sinPorcion, 150);
    expect(r.kcal).toBe(200);
    expect(r.porcionG).toBe(150);
  });

  it("una porción previa de cero no divide por cero", () => {
    const r = recalcularPorcion(item({ porcionG: 0, kcal: 200 }), 100);
    expect(Number.isFinite(r.kcal)).toBe(true);
    expect(r.kcal).toBe(200);
  });
});

describe("el resultado no depende de cómo se tecleó", () => {
  // Esto corre en cada tecla: escribir "300" pasa por 3 y por 30. Si cada paso
  // redondeara, el paso por 3 ml perdería precisión que no vuelve, y 250→300
  // daría 130 kcal en vez de 134.4 — medido en el navegador, no supuesto.
  const jugo = item({
    porcionG: null,
    porcionMl: 250,
    kcal: 112,
    proteinaG: 1.8,
    carbsG: 26,
    grasaG: 0.5,
  });

  it("de un saque da lo mismo que tecla por tecla", () => {
    const directo = recalcularPorcion(jugo, 300);

    let tecleado = jugo;
    for (const paso of [3, 30, 300]) {
      tecleado = recalcularPorcion(tecleado, paso);
    }

    expect(tecleado.kcal).toBeCloseTo(directo.kcal, 6);
    expect(tecleado.carbsG).toBeCloseTo(directo.carbsG, 6);
    expect(directo.kcal).toBeCloseTo(134.4, 6);
  });

  it("aguanta borrar y reescribir varias veces", () => {
    let x = jugo;
    // Como quien se equivoca, borra y vuelve a empezar. Tres veces.
    for (const secuencia of [[1, 15, 150], [2, 20, 200], [2, 25, 250]]) {
      for (const paso of secuencia) x = recalcularPorcion(x, paso);
    }
    // Vuelve a 250 ml: tiene que volver a las 112 kcal del principio.
    expect(x.kcal).toBeCloseTo(112, 6);
    expect(x.porcionMl).toBe(250);
  });
});

describe("lo que no se toca", () => {
  it("conserva el nombre, el enlace y la nota", () => {
    const original = item({
      foodId: "33333333-3333-4333-8333-333333333333",
      alimento: "Quesito colombiano",
      nota: "dejó la mitad",
    });
    const r = recalcularPorcion(original, 60);
    expect(r.alimento).toBe("Quesito colombiano");
    expect(r.foodId).toBe(original.foodId);
    expect(r.nota).toBe("dejó la mitad");
  });

  it("no muta el ítem original", () => {
    const original = item({ porcionG: 100 });
    recalcularPorcion(original, 200, POLLO);
    expect(original.porcionG).toBe(100);
    expect(original.kcal).toBe(200);
  });
});
