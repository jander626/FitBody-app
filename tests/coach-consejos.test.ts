/**
 * Tests de los consejos semanales.
 *
 * La regla que más se prueba acá no es qué dice la app, sino **cuándo se
 * calla**. Un consejo con evidencia inventada o sacado de tres días es peor
 * que ninguno: tiene el mismo tono de autoridad y lleva a cambiar el plan por
 * una razón falsa.
 */
import { describe, expect, it } from "vitest";
import {
  DIAS_MINIMOS,
  generarConsejos,
  type DiaConsejo,
  type EntradaConsejos,
  type MetricaConsejo,
} from "@/lib/coach/consejos";

const OBJETIVO = { kcal: 1850, proteinaG: 160 };
const DIA_MS = 86_400_000;
const FIN = Date.parse("2026-08-30T00:00:00Z");

function fechas(n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(FIN - (n - 1 - i) * DIA_MS).toISOString().slice(0, 10),
  );
}

function dias(n: number, cambios: Partial<DiaConsejo> = {}): DiaConsejo[] {
  return fechas(n).map((fecha) => ({
    fecha,
    kcal: 1800,
    proteinaG: 155,
    carbsG: 140,
    grasaG: 68,
    comidas: 4,
    gastoKcal: 2450,
    gastoMedido: false,
    deficit: 650,
    ...cambios,
  }));
}

function entrada(over: Partial<EntradaConsejos> = {}): EntradaConsejos {
  return {
    dias: dias(7),
    metricas: [],
    objetivo: OBJETIVO,
    gastoEstimado: 2450,
    ...over,
  };
}

const ids = (cs: { id: string }[]) => cs.map((c) => c.id);

describe("cuándo se calla", () => {
  it("con pocos días no opina de nada más", () => {
    const cs = generarConsejos(entrada({ dias: dias(DIAS_MINIMOS - 1) }));
    expect(ids(cs)).toEqual(["pocos-datos"]);
  });

  it("los días sin comidas no cuentan como registrados", () => {
    const conHuecos = [...dias(3), ...dias(4, { comidas: 0 })];
    const cs = generarConsejos(entrada({ dias: conHuecos }));
    expect(ids(cs)).toContain("pocos-datos");
  });

  it("no habla de pasos con menos de cuatro días medidos", () => {
    const metricas: MetricaConsejo[] = fechas(3).map((fecha) => ({
      fecha,
      pasos: 9000,
      suenoHoras: null,
      kcalTotales: null,
    }));
    const cs = generarConsejos(entrada({ metricas }));
    expect(ids(cs).some((i) => i.startsWith("pasos"))).toBe(false);
  });

  it("no habla de sueño con menos de cuatro noches", () => {
    const metricas: MetricaConsejo[] = fechas(3).map((fecha) => ({
      fecha,
      pasos: null,
      suenoHoras: 5,
      kcalTotales: null,
    }));
    const cs = generarConsejos(entrada({ metricas }));
    expect(ids(cs).some((i) => i.startsWith("sueno"))).toBe(false);
  });

  it("todo consejo trae evidencia; ninguno va vacío", () => {
    const metricas: MetricaConsejo[] = fechas(7).map((fecha, i) => ({
      fecha,
      pasos: 8000 + i * 500,
      suenoHoras: 7,
      kcalTotales: 2500,
    }));
    const cs = generarConsejos(entrada({ metricas }));
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(c.evidencia.length).toBeGreaterThan(0);
      expect(c.titulo.length).toBeGreaterThan(0);
      expect(c.detalle.length).toBeGreaterThan(0);
    }
  });
});

describe("calorías", () => {
  it("cumplir sale como confirmación, no como silencio", () => {
    const cs = generarConsejos(entrada());
    const c = cs.find((x) => x.id === "calorias-bien");
    expect(c).toBeDefined();
    expect(c!.evidencia.join(" ")).toContain("1800");
  });

  it("pasarse mucho es lo más urgente de la lista", () => {
    const cs = generarConsejos(entrada({ dias: dias(7, { kcal: 2200 }) }));
    expect(cs[0].id).toBe("calorias-por-encima");
    expect(cs[0].titulo).toContain("350"); // 2200 - 1850
  });

  it("si todos los días tuvieron déficit, lo dice antes de mandar a recortar", () => {
    const cs = generarConsejos(
      entrada({ dias: dias(7, { kcal: 2100, deficit: 350 }) }),
    );
    const c = cs.find((x) => x.id === "calorias-por-encima");
    expect(c!.detalle).toContain("porciones estimadas");
  });

  it("los días sin déficit se señalan aparte", () => {
    const mezcla = [
      ...dias(5, { kcal: 1800, deficit: 650 }),
      ...dias(2, { kcal: 2600, deficit: -150 }).map((d, i) => ({
        ...d,
        fecha: fechas(7)[5 + i],
      })),
    ];
    const cs = generarConsejos(entrada({ dias: mezcla }));
    const c = cs.find((x) => x.id === "calorias-por-encima");
    expect(c!.detalle).toContain("no restaron nada");
  });
});

describe("proteína", () => {
  it("quedar corto la mayoría de los días es prioritario", () => {
    const cs = generarConsejos(entrada({ dias: dias(7, { proteinaG: 110 }) }));
    const c = cs.find((x) => x.id === "proteina-corta");
    expect(c).toBeDefined();
    expect(c!.titulo).toContain("7 de 7");
    // El consejo tiene que ser accionable, no una regañina.
    expect(c!.detalle).toMatch(/huevo|pollo|atún/);
  });

  it("el 90 % cuenta como cumplido", () => {
    // 145 de 160 es el 90.6 %: apuntar a un piso no es fallar por 15 g.
    const cs = generarConsejos(entrada({ dias: dias(7, { proteinaG: 145 }) }));
    expect(ids(cs)).toContain("proteina-bien");
  });
});

describe("gasto medido contra fórmula", () => {
  it("sin días medidos explica qué se está perdiendo", () => {
    const cs = generarConsejos(entrada());
    const c = cs.find((x) => x.id === "gasto-sin-medir");
    expect(c!.detalle).toContain("Garmin");
  });

  it("una diferencia grande se reporta con los dos números", () => {
    const cs = generarConsejos(
      entrada({ dias: dias(7, { gastoMedido: true, gastoKcal: 2750 }) }),
    );
    const c = cs.find((x) => x.id === "gasto-difiere");
    expect(c!.titulo).toContain("300"); // 2750 - 2450
    expect(c!.evidencia.join(" ")).toContain("2450");
  });

  it("una diferencia menor al error de medición no se convierte en consejo", () => {
    const cs = generarConsejos(
      entrada({ dias: dias(7, { gastoMedido: true, gastoKcal: 2500 }) }),
    );
    expect(ids(cs)).toContain("gasto-coincide");
    expect(ids(cs)).not.toContain("gasto-difiere");
  });
});

describe("sueño: asociación, nunca causa", () => {
  function conSueno(horas: number[], kcal: number[]): EntradaConsejos {
    const fs = fechas(horas.length);
    return entrada({
      dias: fs.map((fecha, i) => dias(1, { fecha, kcal: kcal[i] })[0]),
      metricas: fs.map((fecha, i) => ({
        fecha,
        pasos: null,
        suenoHoras: horas[i],
        kcalTotales: null,
      })),
    });
  }

  it("cuando las noches cortas coinciden con comer más, lo dice sin afirmar causa", () => {
    const cs = generarConsejos(
      conSueno([5, 5.5, 7.5, 8, 7, 7.5], [2300, 2250, 1800, 1750, 1820, 1780]),
    );
    const c = cs.find((x) => x.id === "sueno-y-comida");
    expect(c).toBeDefined();
    expect(c!.detalle).toContain("no se puede afirmar que una cause la otra");
  });

  it("con una sola noche corta no saca conclusiones", () => {
    const cs = generarConsejos(
      conSueno([5, 7.5, 8, 7, 7.5, 8], [2300, 1800, 1750, 1820, 1780, 1790]),
    );
    expect(ids(cs)).not.toContain("sueno-y-comida");
  });

  it("dormir poco de forma sostenida se señala solo", () => {
    const cs = generarConsejos(
      conSueno([5.5, 6, 5.8, 6.2, 5.9, 6.1], [1800, 1810, 1790, 1820, 1805, 1795]),
    );
    expect(ids(cs)).toContain("sueno-corto");
  });
});

describe("pasos", () => {
  it("compara los días de más movimiento con los de menos", () => {
    const fs = fechas(6);
    const cs = generarConsejos(
      entrada({
        dias: fs.map((fecha, i) => dias(1, { fecha, deficit: i < 3 ? 400 : 800 })[0]),
        metricas: fs.map((fecha, i) => ({
          fecha,
          pasos: i < 3 ? 5000 : 14000,
          suenoHoras: null,
          kcalTotales: null,
        })),
      }),
    );
    const c = cs.find((x) => x.id === "pasos-y-deficit");
    expect(c).toBeDefined();
    expect(c!.titulo).toContain("mayor");
    // El texto tiene que dejar claro que van juntas, no que una causa la otra.
    expect(c!.detalle).toContain("Van juntas");
  });

  it("si el déficit es MENOR los días activos, lo dice al revés", () => {
    // Moverse abre el apetito: es un resultado normal. Mantener el título
    // "el déficit es mayor" porque suena mejor sería mentir con los números
    // impresos al lado, que es la peor forma de mentir.
    const fs = fechas(6);
    const cs = generarConsejos(
      entrada({
        dias: fs.map((fecha, i) => dias(1, { fecha, deficit: i < 3 ? 900 : 350 })[0]),
        metricas: fs.map((fecha, i) => ({
          fecha,
          pasos: i < 3 ? 5000 : 14000,
          suenoHoras: null,
          kcalTotales: null,
        })),
      }),
    );
    const c = cs.find((x) => x.id === "pasos-y-deficit");
    expect(c!.titulo).toContain("menor");
    expect(c!.evidencia.join(" ")).toContain("350");
  });

  it("una diferencia chica no se convierte en hallazgo", () => {
    const fs = fechas(6);
    const cs = generarConsejos(
      entrada({
        dias: fs.map((fecha, i) => dias(1, { fecha, deficit: i < 3 ? 640 : 690 })[0]),
        metricas: fs.map((fecha, i) => ({
          fecha,
          pasos: i < 3 ? 5000 : 14000,
          suenoHoras: null,
          kcalTotales: null,
        })),
      }),
    );
    expect(ids(cs)).not.toContain("pasos-y-deficit");
    expect(ids(cs)).toContain("pasos-promedio");
  });
});

describe("días sin registrar", () => {
  it("los cuenta y explica por qué no son neutros", () => {
    const cs = generarConsejos(entrada({ dias: dias(5) }));
    const c = cs.find((x) => x.id === "dias-sin-registrar");
    expect(c).toBeDefined();
    expect(c!.detalle).toContain("desconocidos");
  });

  it("una semana completa no lo menciona", () => {
    const cs = generarConsejos(entrada({ dias: dias(8) }));
    expect(ids(cs)).not.toContain("dias-sin-registrar");
  });
});
