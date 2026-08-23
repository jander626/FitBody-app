/**
 * Tests dorados del motor de nutrición.
 *
 * La referencia no es un valor inventado: es fitfood/data/perfil.json, el plan
 * con el que la persona lleva viviendo desde el día 1. Si el motor no
 * reproduce esos números, el motor está mal — no el perfil.
 */
import { describe, expect, it } from "vitest";
import {
  ajusteSemanal,
  calcularPlan,
  imc,
  kcalObjetivo,
  macros,
  mediaMovil7d,
  redondearA,
  ritmoEsperado,
  ritmoSemanal,
  tdee,
  tmb,
  type DatosPersona,
  type RegistroPeso,
} from "@/lib/nutrition";

/** Los datos reales del intake (fitfood/data/perfil.json). */
const PERSONA: DatosPersona = {
  sexo: "hombre",
  edad: 37,
  estaturaCm: 170,
  pesoKg: 79.4,
};
const FACTOR_ACTIVIDAD = 1.46;
const DEFICIT_PCT = 24;

describe("perfil real de la bitácora", () => {
  it("reproduce la TMB de Mifflin-St Jeor", () => {
    // 10·79.4 + 6.25·170 − 5·37 + 5 = 1676.5
    // perfil.json muestra 1676 porque trunca; acá se conserva el valor exacto
    // para no arrastrar el error a lo que viene después.
    expect(tmb(PERSONA)).toBeCloseTo(1676.5, 6);
    expect(Math.trunc(tmb(PERSONA))).toBe(1676);
  });

  it("reproduce el gasto energético total", () => {
    expect(tdee(tmb(PERSONA), FACTOR_ACTIVIDAD)).toBe(2450);
  });

  it("reproduce el objetivo calórico", () => {
    const gasto = tdee(tmb(PERSONA), FACTOR_ACTIVIDAD);
    expect(kcalObjetivo(gasto, DEFICIT_PCT)).toBe(1850);
  });

  it("reproduce el reparto de macros 160P / 145C / 70G", () => {
    expect(macros(PERSONA.pesoKg, 1850)).toEqual({
      proteinaG: 160,
      carbsG: 145,
      grasaG: 70,
    });
  });

  it("el plan completo cuadra de punta a punta", () => {
    const plan = calcularPlan(
      PERSONA,
      FACTOR_ACTIVIDAD,
      "perder_grasa",
      DEFICIT_PCT,
    );

    expect(plan.tdeeKcal).toBe(2450);
    expect(plan.kcalObjetivo).toBe(1850);
    expect(plan.proteinaG).toBe(160);
    expect(plan.carbsG).toBe(145);
    expect(plan.grasaG).toBe(70);
    // Un plan sano no debería levantar avisos de atención.
    expect(plan.avisos.filter((a) => a.nivel === "atencion")).toEqual([]);
  });

  it("las macros suman el objetivo calórico", () => {
    const { proteinaG, carbsG, grasaG } = macros(PERSONA.pesoKg, 1850);
    expect(proteinaG * 4 + carbsG * 4 + grasaG * 9).toBe(1850);
  });

  it("reproduce el IMC del perfil", () => {
    expect(imc(PERSONA.pesoKg, PERSONA.estaturaCm)).toBeCloseTo(27.5, 1);
  });
});

describe("reglas de seguridad", () => {
  it("no propone un objetivo por debajo del piso, y lo dice", () => {
    const plan = calcularPlan(PERSONA, 1.2, "perder_grasa", 50);
    expect(plan.kcalObjetivo).toBe(1500);
    expect(plan.avisos.some((a) => a.nivel === "atencion")).toBe(true);
    expect(plan.avisos[0].mensaje).toContain("piso");
  });

  it("usa un piso distinto para mujeres", () => {
    const plan = calcularPlan(
      { ...PERSONA, sexo: "mujer" },
      1.2,
      "perder_grasa",
      50,
    );
    expect(plan.kcalObjetivo).toBe(1200);
  });

  it("avisa cuando el IMC es demasiado bajo para un déficit", () => {
    const plan = calcularPlan(
      { ...PERSONA, pesoKg: 50 },
      FACTOR_ACTIVIDAD,
      "perder_grasa",
    );
    expect(plan.avisos.some((a) => a.mensaje.includes("IMC"))).toBe(true);
  });

  it("nunca devuelve carbohidratos negativos", () => {
    // Objetivo diminuto con una persona grande: proteína y grasa se comen todo.
    const reparto = macros(120, 800);
    expect(reparto.carbsG).toBe(0);
  });

  it("no lanza con datos absurdos, solo avisa", () => {
    expect(() =>
      calcularPlan({ ...PERSONA, pesoKg: 200 }, 2.0, "perder_grasa", 40),
    ).not.toThrow();
  });
});

describe("ritmo esperado", () => {
  it("con déficit el cambio es negativo y el intervalo va ordenado", () => {
    const r = ritmoEsperado(79.4, 2450, 1850);
    expect(r.min).toBeLessThan(0);
    expect(r.max).toBeLessThan(0);
    expect(r.min).toBeLessThanOrEqual(r.max);
    // 600 kcal/día → 4200 kcal/semana → ~0.55 kg/semana teóricos.
    expect(r.max).toBeCloseTo(-0.44, 2);
    expect(r.min).toBeCloseTo(-0.57, 2);
  });

  it("con superávit el cambio es positivo", () => {
    const r = ritmoEsperado(79.4, 2450, 2750);
    expect(r.min).toBeGreaterThan(0);
    expect(r.min).toBeLessThanOrEqual(r.max);
  });

  it("acota a ~1 % del peso corporal por semana", () => {
    const r = ritmoEsperado(60, 2400, 1000);
    expect(Math.abs(r.min)).toBeLessThanOrEqual(0.6);
  });
});

describe("redondeo", () => {
  it("redondea al múltiplo pedido", () => {
    expect(redondearA(2447.69, 10)).toBe(2450);
    expect(redondearA(1862, 50)).toBe(1850);
    expect(redondearA(158.8, 5)).toBe(160);
    expect(redondearA(71.46, 5)).toBe(70);
  });
});

// ------------------------------------------------------------ tendencia ---

/** Genera pesajes diarios desde una fecha, bajando `porDia` kg cada día. */
function serieDiaria(
  desde: string,
  dias: number,
  inicial: number,
  porDia: number,
  ruido: (i: number) => number = () => 0,
): RegistroPeso[] {
  const t0 = Date.parse(`${desde}T00:00:00Z`);
  return Array.from({ length: dias }, (_, i) => ({
    fecha: new Date(t0 + i * 86_400_000).toISOString().slice(0, 10),
    pesoKg: Math.round((inicial + porDia * i + ruido(i)) * 100) / 100,
  }));
}

describe("media móvil de 7 días", () => {
  it("no inventa una media sin datos suficientes", () => {
    const serie = mediaMovil7d(serieDiaria("2026-08-12", 3, 78.9, -0.08));
    expect(serie.every((p) => p.mediaKg === null)).toBe(true);
  });

  it("suaviza el ruido diario", () => {
    // ±0.8 kg de ruido alternado sobre una bajada limpia.
    const conRuido = serieDiaria("2026-08-12", 14, 78.9, -0.08, (i) =>
      i % 2 === 0 ? 0.8 : -0.8,
    );
    const serie = mediaMovil7d(conRuido);
    const ultimo = serie[serie.length - 1];

    expect(ultimo.mediaKg).not.toBeNull();
    // La media queda mucho más cerca de la tendencia real que el dato crudo.
    const tendenciaReal = 78.9 - 0.08 * 10;
    expect(Math.abs(ultimo.mediaKg! - tendenciaReal)).toBeLessThan(0.5);
  });

  it("promedia por días calendario, no por número de registros", () => {
    // Pesajes salteados: si promediara "los últimos 7 registros" mezclaría
    // casi dos semanas.
    const salteados: RegistroPeso[] = [
      { fecha: "2026-08-01", pesoKg: 82 },
      { fecha: "2026-08-03", pesoKg: 82 },
      { fecha: "2026-08-05", pesoKg: 82 },
      { fecha: "2026-08-20", pesoKg: 79 },
      { fecha: "2026-08-21", pesoKg: 79 },
      { fecha: "2026-08-22", pesoKg: 79 },
      { fecha: "2026-08-23", pesoKg: 79 },
    ];
    const serie = mediaMovil7d(salteados);
    const ultimo = serie[serie.length - 1];
    // Solo entran los 4 pesajes de la última semana, no los de agosto 1-5.
    expect(ultimo.mediaKg).toBe(79);
  });

  it("ordena la serie aunque los registros lleguen desordenados", () => {
    const desordenados = [...serieDiaria("2026-08-12", 10, 78.9, -0.08)].reverse();
    const serie = mediaMovil7d(desordenados);
    const fechas = serie.map((p) => p.fecha);
    expect(fechas).toEqual([...fechas].sort());
  });
});

describe("ajuste semanal", () => {
  const RITMO = { min: -0.57, max: -0.44 };

  it("no sugiere nada sin dos semanas de datos", () => {
    const r = ajusteSemanal(
      serieDiaria("2026-08-12", 10, 78.9, -0.08),
      1850,
      RITMO,
      "hombre",
    );
    expect(r.sugerencia).toBe("sin_datos");
    expect(r.kcalPropuesto).toBe(1850);
  });

  it("mantiene cuando el ritmo va en rango", () => {
    // -0.07 kg/día ≈ -0.49 kg/semana, justo en medio del rango.
    const r = ajusteSemanal(
      serieDiaria("2026-08-01", 21, 79.4, -0.07),
      1850,
      RITMO,
      "hombre",
    );
    expect(ritmoSemanal(mediaMovil7d(serieDiaria("2026-08-01", 21, 79.4, -0.07)), 0))
      .toBeCloseTo(-0.49, 1);
    expect(r.sugerencia).toBe("mantener");
    expect(r.kcalPropuesto).toBe(1850);
  });

  it("sugiere bajar cuando el peso lleva dos semanas quieto", () => {
    const r = ajusteSemanal(
      serieDiaria("2026-08-01", 21, 79.4, 0),
      1850,
      RITMO,
      "hombre",
    );
    expect(r.sugerencia).toBe("bajar");
    expect(r.kcalPropuesto).toBeLessThan(1850);
    // Peso totalmente quieto es la desviación máxima: corresponde el 10 %.
    expect(r.pct).toBe(10);
    expect(r.kcalPropuesto).toBe(1650);
  });

  it("sugiere subir cuando se baja demasiado rápido", () => {
    // -0.2 kg/día = -1.4 kg/semana, muy por encima de lo sostenible.
    const r = ajusteSemanal(
      serieDiaria("2026-08-01", 21, 82, -0.2),
      1850,
      RITMO,
      "hombre",
    );
    expect(r.sugerencia).toBe("subir");
    expect(r.kcalPropuesto).toBeGreaterThan(1850);
  });

  it("no propone bajar por debajo del piso: cambia la recomendación", () => {
    const r = ajusteSemanal(
      serieDiaria("2026-08-01", 21, 79.4, 0),
      1500,
      RITMO,
      "hombre",
    );
    expect(r.sugerencia).toBe("mantener");
    expect(r.kcalPropuesto).toBe(1500);
    expect(r.razon).toContain("piso");
  });

  it("una sola semana mala no alcanza para mover nada", () => {
    // Dos semanas completas bajando bien, y solo la última quieta.
    //
    // El bloque que baja tiene que durar 14 días, no 11: la media móvil mira
    // 7 días hacia atrás, así que el ritmo de "la semana pasada" se calcula
    // con ventanas que llegan hasta 14 días atrás. Si el tramo bueno es más
    // corto, la ventana de la semana pasada ya viene contaminada por el tramo
    // quieto y las dos semanas leen como lentas — que es justo lo que este
    // test debe distinguir.
    const bajando = serieDiaria("2026-08-01", 14, 79.4, -0.07);
    const ultimoPeso = bajando[bajando.length - 1].pesoKg;
    const quieta = serieDiaria("2026-08-15", 7, ultimoPeso, 0);
    const registros = [...bajando, ...quieta];

    const serie = mediaMovil7d(registros);
    expect(ritmoSemanal(serie, 1)).toBeCloseTo(-0.49, 2); // semana pasada: en rango
    expect(ritmoSemanal(serie, 0)).toBeCloseTo(-0.21, 2); // esta semana: lenta

    const r = ajusteSemanal(registros, 1850, RITMO, "hombre");
    expect(r.sugerencia).toBe("mantener");
  });

  it("siempre devuelve el objetivo actual como referencia", () => {
    const r = ajusteSemanal([], 1850, RITMO, "hombre");
    expect(r.kcalActual).toBe(1850);
    expect(r.kcalPropuesto).toBe(1850);
  });
});
