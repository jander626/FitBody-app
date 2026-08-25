/**
 * Tests de la clasificación de días.
 *
 * Los tres estados no son "bien / regular / mal": describen qué le pasó al
 * déficit, que es lo que mueve el peso. Esa distinción es la que le da sentido
 * al calendario, así que conviene fijarla.
 */
import { describe, expect, it } from "vitest";
import {
  clasificarDia,
  cuadriculaMes,
  promedios,
  resumir,
  sumarMeses,
  type DiaHistorial,
} from "@/lib/historial";

const OBJETIVO = 1850;
const GASTO = 2450;

describe("clasificar un día", () => {
  it("dentro del objetivo", () => {
    expect(clasificarDia(1700, OBJETIVO, GASTO)).toBe("objetivo");
    expect(clasificarDia(1850, OBJETIVO, GASTO)).toBe("objetivo");
  });

  it("da un 5 % de margen antes de sacarlo del objetivo", () => {
    // Pasarse por 40 kcal no cambia el día.
    expect(clasificarDia(1940, OBJETIVO, GASTO)).toBe("objetivo");
    expect(clasificarDia(1942, OBJETIVO, GASTO)).toBe("objetivo"); // 1850 × 1.05 = 1942.5
    expect(clasificarDia(1943, OBJETIVO, GASTO)).toBe("deficit"); // justo pasado
    expect(clasificarDia(1960, OBJETIVO, GASTO)).toBe("deficit");
  });

  it("sobre el objetivo pero bajo el gasto sigue siendo déficit", () => {
    // Este es el estado que importa distinguir: comiste más de lo planeado,
    // pero el día igual resta.
    expect(clasificarDia(2100, OBJETIVO, GASTO)).toBe("deficit");
    expect(clasificarDia(2449, OBJETIVO, GASTO)).toBe("deficit");
  });

  it("sobre el gasto no hay déficit", () => {
    expect(clasificarDia(2450, OBJETIVO, GASTO)).toBe("sin_deficit");
    expect(clasificarDia(3000, OBJETIVO, GASTO)).toBe("sin_deficit");
  });

  it("clasifica los días reales de la bitácora", () => {
    // Días 12 al 24 de agosto, calorías reales.
    const reales: [number, string][] = [
      [1738, "objetivo"],
      [1959, "deficit"],
      [2002, "deficit"],
      [2409, "deficit"],
      [1845, "objetivo"],
      [2048, "deficit"],
      [1819, "objetivo"],
      [1640, "objetivo"],
      [1846, "objetivo"],
      [1997, "deficit"],
      [1829, "objetivo"],
      [2184, "deficit"],
      [2331, "deficit"],
    ];
    for (const [kcal, esperado] of reales) {
      expect(clasificarDia(kcal, OBJETIVO, GASTO), `${kcal} kcal`).toBe(esperado);
    }
  });
});

describe("resumen de días", () => {
  const dias: DiaHistorial[] = [
    { fecha: "2026-08-24", kcal: 2331, proteinaG: 182, carbsG: 169, grasaG: 101, comidas: 5 },
    { fecha: "2026-08-23", kcal: 2184, proteinaG: 104, carbsG: 186, grasaG: 108, comidas: 4 },
  ];

  it("calcula el déficit real de cada día", () => {
    const r = resumir(dias, { kcal: OBJETIVO, proteinaG: 160 }, GASTO);
    expect(r[0].deficit).toBe(119); // 2450 − 2331
    expect(r[1].deficit).toBe(266);
  });

  it("el déficit es negativo cuando se comió sobre el gasto", () => {
    const r = resumir(
      [{ fecha: "x", kcal: 2800, proteinaG: 100, carbsG: 100, grasaG: 100, comidas: 1 }],
      { kcal: OBJETIVO, proteinaG: 160 },
      GASTO,
    );
    expect(r[0].deficit).toBe(-350);
  });

  it("calcula el porcentaje de proteína", () => {
    const r = resumir(dias, { kcal: OBJETIVO, proteinaG: 160 }, GASTO);
    expect(r[0].pctProteina).toBe(114); // 182 de 160
    expect(r[1].pctProteina).toBe(65);
  });

  it("sin objetivo de proteína no divide por cero", () => {
    const r = resumir(dias, { kcal: OBJETIVO, proteinaG: 0 }, GASTO);
    expect(r[0].pctProteina).toBe(0);
  });
});

describe("promedios", () => {
  it("promedia y cuenta los días en objetivo", () => {
    const dias = resumir(
      [
        { fecha: "a", kcal: 1800, proteinaG: 160, carbsG: 140, grasaG: 70, comidas: 3 },
        { fecha: "b", kcal: 2200, proteinaG: 140, carbsG: 160, grasaG: 90, comidas: 3 },
      ],
      { kcal: OBJETIVO, proteinaG: 160 },
      GASTO,
    );
    const p = promedios(dias)!;
    expect(p.kcal).toBe(2000);
    expect(p.deficit).toBe(450); // 2450 − 2000
    expect(p.enObjetivo).toBe(1);
    expect(p.dias).toBe(2);
  });

  it("sin días devuelve null, no ceros", () => {
    // Un cero acá se leería como "comiste 0 kcal", que es falso.
    expect(promedios([])).toBeNull();
  });
});

describe("cuadrícula del mes", () => {
  it("agosto de 2026 empieza en sábado", () => {
    const celdas = cuadriculaMes(2026, 7);
    // Semana de lunes a domingo: sábado deja 5 huecos antes.
    expect(celdas.slice(0, 5).every((c) => c === null)).toBe(true);
    expect(celdas[5]).toBe("2026-08-01");
  });

  it("siempre completa semanas enteras", () => {
    for (let mes = 0; mes < 12; mes++) {
      expect(cuadriculaMes(2026, mes).length % 7).toBe(0);
    }
  });

  it("incluye todos los días del mes", () => {
    const celdas = cuadriculaMes(2026, 1).filter(Boolean);
    expect(celdas.length).toBe(28); // febrero 2026
    expect(celdas.at(-1)).toBe("2026-02-28");
  });

  it("maneja los años bisiestos", () => {
    expect(cuadriculaMes(2028, 1).filter(Boolean).length).toBe(29);
  });
});

describe("moverse de mes", () => {
  it("avanza y retrocede", () => {
    expect(sumarMeses(2026, 7, 1)).toEqual({ anio: 2026, mes: 8 });
    expect(sumarMeses(2026, 7, -1)).toEqual({ anio: 2026, mes: 6 });
  });

  it("cruza el cambio de año", () => {
    expect(sumarMeses(2026, 11, 1)).toEqual({ anio: 2027, mes: 0 });
    expect(sumarMeses(2026, 0, -1)).toEqual({ anio: 2025, mes: 11 });
  });
});
