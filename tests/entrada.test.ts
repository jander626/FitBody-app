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

describe("dieta y fuerza", () => {
  const kcalDe = (m: { proteinaG: number; carbsG: number; grasaG: number }) =>
    m.proteinaG * 4 + m.carbsG * 4 + m.grasaG * 9;

  it("sin dieta ni fuerza todo queda como antes", () => {
    const a = planDeEntrada(BASE).calculo;
    const b = planDeEntrada({ ...BASE, dieta: "recomendada", fuerza: true }).calculo;
    expect([b.proteinaG, b.carbsG, b.grasaG]).toEqual([a.proteinaG, a.carbsG, a.grasaG]);
  });

  it("alta en proteína sube la proteína y baja la grasa", () => {
    const base = planDeEntrada(BASE).calculo;
    const alta = planDeEntrada({ ...BASE, dieta: "alta_proteina" }).calculo;
    expect(alta.proteinaG).toBeGreaterThan(base.proteinaG);
    expect(alta.grasaG).toBeLessThan(base.grasaG);
  });

  it("baja en carbohidratos y keto reducen los carbohidratos, keto más", () => {
    const base = planDeEntrada(BASE).calculo;
    const baja = planDeEntrada({ ...BASE, dieta: "baja_carbs" }).calculo;
    const keto = planDeEntrada({ ...BASE, dieta: "keto" }).calculo;
    expect(baja.carbsG).toBeLessThan(base.carbsG);
    expect(keto.carbsG).toBeLessThan(baja.carbsG);
    expect(keto.carbsG).toBeLessThanOrEqual(30);
    expect(keto.grasaG).toBeGreaterThan(baja.grasaG);
  });

  it("baja en grasas usa el mínimo fisiológico", () => {
    const r = planDeEntrada({ ...BASE, dieta: "baja_grasa" }).calculo;
    expect(r.grasaG).toBe(Math.round((BASE.pesoKg * 0.6) / 5) * 5);
  });

  it("sin entrenar fuerza baja la proteína, sin pasar del piso de 1,4 g/kg", () => {
    const con = planDeEntrada({ ...BASE, fuerza: true }).calculo;
    const sin = planDeEntrada({ ...BASE, fuerza: false }).calculo;
    expect(sin.proteinaG).toBeLessThan(con.proteinaG);
    expect(sin.proteinaG).toBeGreaterThanOrEqual(BASE.pesoKg * 1.4 - 5);
  });

  it("cada dieta reparte las mismas calorías: los macros suman el objetivo", () => {
    for (const dieta of ["recomendada", "alta_proteina", "baja_carbs", "keto", "baja_grasa"] as const) {
      const { calculo } = planDeEntrada({ ...BASE, dieta });
      expect(Math.abs(kcalDe(calculo) - calculo.kcalObjetivo), dieta).toBeLessThanOrEqual(45);
    }
  });

  it("el esquema acepta dietas conocidas y rechaza las inventadas", () => {
    expect(entradaDeMetadata({ ...BASE, dieta: "keto", fuerza: false })).not.toBeNull();
    expect(entradaDeMetadata({ ...BASE, dieta: "carnivora" })).toBeNull();
    expect(entradaDeMetadata({ ...BASE, fuerza: "si" })).toBeNull();
  });
});

describe("fuerza por días", () => {
  const prot = (fuerza: Entrada["fuerza"]) => planDeEntrada({ ...BASE, fuerza }).calculo.proteinaG;

  it("la proteína baja con menos fuerza y no sube por entrenar más", () => {
    expect(prot("ninguna")).toBeLessThan(prot("1-2"));
    expect(prot("1-2")).toBeLessThan(prot("3-4"));
    expect(prot("5+")).toBe(prot("3-4"));
  });

  it("1-2 veces resta 0,2 g/kg: con 80 kg, de 160 a 145 g (redondeo a 5)", () => {
    expect(prot("3-4")).toBe(160);
    expect(prot("1-2")).toBe(145);
  });

  it("el sí/no de antes sigue entendiéndose", () => {
    expect(prot(true)).toBe(prot("3-4"));
    expect(prot(false)).toBe(prot("ninguna"));
    expect(prot(undefined)).toBe(prot("3-4"));
  });

  it("no cambia las calorías, solo el reparto", () => {
    const a = planDeEntrada({ ...BASE, fuerza: "ninguna" }).calculo;
    const b = planDeEntrada({ ...BASE, fuerza: "5+" }).calculo;
    expect(a.kcalObjetivo).toBe(b.kcalObjetivo);
    expect(a.carbsG).toBeGreaterThan(b.carbsG);
  });

  it("el esquema acepta los niveles y rechaza otros", () => {
    expect(entradaDeMetadata({ ...BASE, fuerza: "1-2" })).not.toBeNull();
    expect(entradaDeMetadata({ ...BASE, fuerza: "mucho" })).toBeNull();
  });
});

describe("gasto medido por el reloj", () => {
  // 37 años, 170 cm, 80 kg, hombre, "poco" (1,375): fórmula ≈ 2310 kcal.
  const sinReloj = () => planDeEntrada({ ...BASE, actividad: "moderado", ritmo: "normal" });
  const conReloj = (g: number) =>
    planDeEntrada({ ...BASE, actividad: "moderado", ritmo: "normal", gastoMedidoKcal: g });

  it("sustituye a la fórmula: el gasto del plan es el del reloj, con margen de redondeo", () => {
    const r = conReloj(2364);
    expect(r.gastoUsado).toBe(true);
    expect(Math.abs(r.calculo.tdeeKcal - 2364)).toBeLessThanOrEqual(20);
  });

  it("un gasto menor que la fórmula baja el objetivo", () => {
    expect(sinReloj().calculo.kcalObjetivo).toBe(2100);
    // 20 % bajo 2364 ≈ 1890 → 1900
    expect(conReloj(2364).calculo.kcalObjetivo).toBe(1900);
  });

  it("avisa de que se usó el reloj y no la fórmula", () => {
    const avisos = conReloj(2364).calculo.avisos.map((a) => a.mensaje).join(" ");
    expect(avisos).toMatch(/reloj/);
    expect(avisos).toMatch(/fórmula/);
  });

  it("un gasto imposible se ignora y se usa la fórmula", () => {
    // Menos que el metabolismo basal (~1680) no es un gasto posible.
    const r = conReloj(1300);
    expect(r.gastoUsado).toBe(false);
    expect(r.calculo.kcalObjetivo).toBe(sinReloj().calculo.kcalObjetivo);
    // Y un factor por encima de 2,5 tampoco.
    expect(conReloj(4900).gastoUsado).toBe(false);
  });

  it("el factor guardado reproduce el mismo gasto con la fórmula de siempre", () => {
    const r = conReloj(2364);
    const f = r.parametros.factorActividad;
    expect(f).toBeGreaterThanOrEqual(1.0);
    expect(f).toBeLessThanOrEqual(2.5);
    expect(Math.abs(r.calculo.tmbKcal * f - 2364)).toBeLessThan(10);
  });

  it("el esquema pone límites razonables", () => {
    expect(entradaDeMetadata({ ...BASE, gastoMedidoKcal: 2364 })).not.toBeNull();
    expect(entradaDeMetadata({ ...BASE, gastoMedidoKcal: 300 })).toBeNull();
    expect(entradaDeMetadata({ ...BASE, gastoMedidoKcal: 9000 })).toBeNull();
  });
});
