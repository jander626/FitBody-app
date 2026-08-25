/**
 * Tests de la traducción entre la encuesta y el motor.
 *
 * Lo que se protege acá no es aritmética: es que una respuesta en castellano
 * no termine produciendo un plan que nadie pidió. Un déficit que se cuela en
 * "mantener", o una meta que apunta al objetivo equivocado, dan un número
 * plausible y equivocado — la peor clase de error, porque no se nota.
 */
import { describe, expect, it } from "vitest";
import {
  ACTIVIDADES,
  METAS,
  ORDEN_ACTIVIDADES,
  ORDEN_METAS,
  ORDEN_RITMOS,
  parametrosDe,
  RITMOS,
} from "@/lib/nutrition/metas";
import { calcularPlan, PISO_KCAL } from "@/lib/nutrition";

describe("catálogo de metas", () => {
  it("el orden nombra todas las metas, sin repetir ni faltar", () => {
    expect([...ORDEN_METAS].sort()).toEqual(Object.keys(METAS).sort());
  });

  it("cada meta apunta a un objetivo que la base acepta", () => {
    const validos = ["perder_grasa", "mantener", "ganar_musculo"];
    for (const meta of Object.values(METAS)) {
      expect(validos, meta.id).toContain(meta.objetivo);
    }
  });

  it("mantener no lleva déficit", () => {
    expect(METAS.mantener.deficitPct).toBe(0);
  });

  it("ganar músculo es superávit, no déficit", () => {
    expect(METAS.ganar_musculo.deficitPct).toBeLessThan(0);
  });

  it("tonificar baja más despacio que bajar de peso", () => {
    // Es la distinción entera entre las dos: mismo objetivo, otro dial.
    expect(METAS.tonificar.objetivo).toBe(METAS.bajar_grasa.objetivo);
    expect(METAS.tonificar.deficitPct).toBeLessThan(METAS.bajar_grasa.deficitPct);
    expect(METAS.tonificar.opciones.proteinaGPorKg).toBeGreaterThan(
      METAS.bajar_grasa.opciones.proteinaGPorKg,
    );
  });

  it("ninguna meta baja la grasa del mínimo fisiológico", () => {
    for (const meta of Object.values(METAS)) {
      expect(meta.opciones.grasaGPorKg, meta.id).toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe("niveles de actividad", () => {
  it("el orden nombra todos los niveles", () => {
    expect([...ORDEN_ACTIVIDADES].sort()).toEqual(Object.keys(ACTIVIDADES).sort());
  });

  it("van de menos a más, sin empates", () => {
    const factores = ORDEN_ACTIVIDADES.map((n) => ACTIVIDADES[n].factor);
    expect(factores).toEqual([...factores].sort((a, b) => a - b));
    expect(new Set(factores).size).toBe(factores.length);
  });

  it("todos caben en lo que acepta la base", () => {
    for (const nivel of Object.values(ACTIVIDADES)) {
      expect(nivel.factor).toBeGreaterThanOrEqual(1.0);
      expect(nivel.factor).toBeLessThanOrEqual(2.5);
    }
  });
});

describe("ritmos", () => {
  it("van de menos a más déficit", () => {
    const pcts = ORDEN_RITMOS.map((r) => RITMOS[r].deficitPct);
    expect(pcts).toEqual([...pcts].sort((a, b) => a - b));
  });

  it("ninguno pasa del 25 %", () => {
    // Por encima se pierde músculo con la grasa y el plan no se sostiene.
    for (const r of Object.values(RITMOS)) {
      expect(r.deficitPct, r.id).toBeLessThanOrEqual(25);
    }
  });
});

describe("traducir respuestas", () => {
  it("usa el ritmo cuando la meta lo pregunta", () => {
    const p = parametrosDe({ meta: "bajar_grasa", actividad: "moderado", ritmo: "rapido" });
    expect(p.deficitPct).toBe(RITMOS.rapido.deficitPct);
    expect(p.factorActividad).toBe(1.55);
  });

  it("ignora un ritmo que llegue en una meta que no lo usa", () => {
    // Sin esto, un ritmo colgado del estado anterior convertiría "mantener"
    // en un déficit del 20 % sin que nadie lo pidiera.
    const p = parametrosDe({ meta: "mantener", actividad: "poco", ritmo: "rapido" });
    expect(p.deficitPct).toBe(0);
  });

  it("sin ritmo cae en el de la meta", () => {
    expect(parametrosDe({ meta: "bajar_grasa", actividad: "poco" }).deficitPct).toBe(20);
    expect(parametrosDe({ meta: "tonificar", actividad: "poco" }).deficitPct).toBe(10);
  });
});

describe("los planes que salen de la encuesta", () => {
  const persona = { sexo: "hombre" as const, edad: 38, estaturaCm: 178, pesoKg: 78.5 };

  function planDe(respuestas: Parameters<typeof parametrosDe>[0]) {
    const p = parametrosDe(respuestas);
    return calcularPlan(persona, p.factorActividad, p.objetivo, p.deficitPct, p.opciones);
  }

  it("ninguna combinación cae bajo el piso calórico", () => {
    // El motor tiene el piso; esto comprueba que la encuesta no ofrezca
    // caminos que lo toquen. Ofrecer algo que después no se puede dar sería
    // peor que no ofrecerlo.
    for (const meta of ORDEN_METAS) {
      for (const actividad of ORDEN_ACTIVIDADES) {
        for (const ritmo of ORDEN_RITMOS) {
          const r = planDe({ meta, actividad, ritmo });
          expect(
            r.kcalObjetivo,
            `${meta}/${actividad}/${ritmo} → ${r.kcalObjetivo} kcal`,
          ).toBeGreaterThanOrEqual(PISO_KCAL.hombre);
        }
      }
    }
  });

  it("bajar de peso da menos calorías que mantener, y ganar músculo más", () => {
    const bajar = planDe({ meta: "bajar_grasa", actividad: "moderado" });
    const mantener = planDe({ meta: "mantener", actividad: "moderado" });
    const ganar = planDe({ meta: "ganar_musculo", actividad: "moderado" });

    expect(bajar.kcalObjetivo).toBeLessThan(mantener.kcalObjetivo);
    expect(ganar.kcalObjetivo).toBeGreaterThan(mantener.kcalObjetivo);
  });

  it("tonificar queda entre bajar de peso y mantener", () => {
    const tonificar = planDe({ meta: "tonificar", actividad: "moderado" });
    expect(tonificar.kcalObjetivo).toBeGreaterThan(
      planDe({ meta: "bajar_grasa", actividad: "moderado" }).kcalObjetivo,
    );
    expect(tonificar.kcalObjetivo).toBeLessThan(
      planDe({ meta: "mantener", actividad: "moderado" }).kcalObjetivo,
    );
  });

  it("moverse más da más calorías con la misma meta", () => {
    const quieto = planDe({ meta: "bajar_grasa", actividad: "sedentario" });
    const activo = planDe({ meta: "bajar_grasa", actividad: "muy_alto" });
    expect(activo.kcalObjetivo).toBeGreaterThan(quieto.kcalObjetivo);
  });

  it("el ritmo rápido pierde más rápido que el suave", () => {
    const suave = planDe({ meta: "bajar_grasa", actividad: "moderado", ritmo: "suave" });
    const rapido = planDe({ meta: "bajar_grasa", actividad: "moderado", ritmo: "rapido" });
    // El ritmo esperado es negativo al perder: más rápido = más negativo.
    expect(rapido.ritmoEsperadoKgSemana.min).toBeLessThan(
      suave.ritmoEsperadoKgSemana.min,
    );
  });

  it("una mujer sedentaria con ritmo rápido tampoco cae bajo su piso", () => {
    // Es la combinación más exigente: el piso de la mujer es más bajo, pero
    // también lo es su gasto.
    const p = parametrosDe({ meta: "bajar_grasa", actividad: "sedentario", ritmo: "rapido" });
    const r = calcularPlan(
      { sexo: "mujer", edad: 45, estaturaCm: 158, pesoKg: 62 },
      p.factorActividad,
      p.objetivo,
      p.deficitPct,
      p.opciones,
    );
    expect(r.kcalObjetivo).toBeGreaterThanOrEqual(PISO_KCAL.mujer);
  });
});
