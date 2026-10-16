import { describe, expect, it } from "vitest";
import {
  EDAD_MINIMA,
  entradaDeMetadata,
  pesoMetaCoherente,
  planDeEntrada,
  rangoDeCalorias,
  semanasHastaMeta,
  type Entrada,
} from "@/lib/entrada/entrada";

const BASE: Entrada = {
  meta: "bajar_grasa",
  actividad: "poco",
  ritmo: "normal",
  sexo: "hombre",
  edad: 37,
  estaturaCm: 170,
  pesoKg: 80,
  pesoMetaKg: 72,
};

describe("entradaDeMetadata", () => {
  it("acepta respuestas completas", () => {
    expect(entradaDeMetadata(BASE)).toEqual(BASE);
  });

  it("rechaza basura, vacío y tipos equivocados", () => {
    for (const malo of [null, undefined, "x", 3, {}, { ...BASE, edad: "37" }]) {
      expect(entradaDeMetadata(malo)).toBeNull();
    }
  });

  it("rechaza menores de edad y valores imposibles", () => {
    expect(entradaDeMetadata({ ...BASE, edad: EDAD_MINIMA - 1 })).toBeNull();
    expect(entradaDeMetadata({ ...BASE, pesoKg: 5 })).toBeNull();
    expect(entradaDeMetadata({ ...BASE, estaturaCm: 400 })).toBeNull();
    expect(entradaDeMetadata({ ...BASE, meta: "volar" })).toBeNull();
  });

  it("descarta campos que no conoce", () => {
    const r = entradaDeMetadata({ ...BASE, admin: true });
    expect(r).not.toHaveProperty("admin");
  });
});

describe("planDeEntrada", () => {
  it("calcula con el mismo motor que la encuesta", () => {
    const { calculo, parametros } = planDeEntrada(BASE);
    expect(parametros.objetivo).toBe("perder_grasa");
    expect(parametros.deficitPct).toBe(20);
    expect(calculo.kcalObjetivo).toBeGreaterThan(1500);
    expect(calculo.proteinaG).toBeGreaterThan(100);
  });

  it("el ritmo no convierte 'mantener' en déficit", () => {
    const { parametros } = planDeEntrada({ ...BASE, meta: "mantener" });
    expect(parametros.deficitPct).toBe(0);
  });
});

describe("rangoDeCalorias", () => {
  it("es ±10 % redondeado a 10 kcal", () => {
    expect(rangoDeCalorias(1779)).toEqual({ min: 1600, max: 1960 });
    expect(rangoDeCalorias(2000)).toEqual({ min: 1800, max: 2200 });
  });
});

describe("pesoMetaCoherente", () => {
  it("bajar y tonificar piden un peso menor; ganar, uno mayor", () => {
    expect(pesoMetaCoherente("bajar_grasa", 80, 72)).toBe(true);
    expect(pesoMetaCoherente("bajar_grasa", 80, 85)).toBe(false);
    expect(pesoMetaCoherente("tonificar", 80, 80)).toBe(false);
    expect(pesoMetaCoherente("ganar_musculo", 70, 75)).toBe(true);
    expect(pesoMetaCoherente("ganar_musculo", 70, 65)).toBe(false);
  });

  it("mantener no tiene meta de peso", () => {
    expect(pesoMetaCoherente("mantener", 80, 79)).toBe(false);
  });
});

describe("semanasHastaMeta", () => {
  it("divide la distancia por el ritmo medio, redondeando hacia arriba", () => {
    // 8 kg a 0.75 kg/semana de media = 10.67 → 11
    expect(semanasHastaMeta(80, 72, { min: -0.9, max: -0.6 })).toBe(11);
  });

  it("null si la meta va al revés del ritmo", () => {
    expect(semanasHastaMeta(80, 85, { min: -0.9, max: -0.6 })).toBeNull();
  });

  it("null con ritmo casi cero o a más de dos años", () => {
    expect(semanasHastaMeta(80, 72, { min: -0.02, max: 0.02 })).toBeNull();
    expect(semanasHastaMeta(120, 60, { min: -0.2, max: -0.1 })).toBeNull();
  });
});
