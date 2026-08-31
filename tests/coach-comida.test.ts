/**
 * Tests de las señales en tiempo real.
 *
 * Lo que se protege acá es que la app no diga cosas que no puede sostener. Un
 * consejo salido de un cálculo mal hecho es peor que ninguno: se ve autoritario
 * y lleva a cambiar la comida por una razón falsa.
 */
import { describe, expect, it } from "vitest";
import { leerComida, type ContextoComida } from "@/lib/coach/comida";
import type { Totales } from "@/lib/registro/tipos";

const OBJETIVO: Totales = { kcal: 1850, proteinaG: 160, carbsG: 145, grasaG: 70 };
const CERO: Totales = { kcal: 0, proteinaG: 0, carbsG: 0, grasaG: 0 };

function ctx(cambios: Partial<ContextoComida> = {}): ContextoComida {
  return { objetivo: OBJETIVO, consumido: CERO, momento: "almuerzo", ...cambios };
}

const ids = (s: { id: string }[]) => s.map((x) => x.id);

describe("cuando no hay nada que decir", () => {
  it("una comida vacía no genera señales", () => {
    expect(leerComida(CERO, ctx())).toEqual([]);
  });

  it("sin objetivo lo dice, en vez de inventar una comparación", () => {
    const s = leerComida({ ...CERO, kcal: 500 }, ctx({ objetivo: null }));
    expect(ids(s)).toEqual(["sin-objetivo"]);
    expect(s[0].texto).toContain("Perfil");
  });
});

describe("calorías", () => {
  it("una comida que encaja lo dice con el número que sobra", () => {
    const s = leerComida(
      { kcal: 500, proteinaG: 40, carbsG: 40, grasaG: 15 },
      ctx({ consumido: { kcal: 400, proteinaG: 30, carbsG: 40, grasaG: 12 } }),
    );
    const kcal = s.find((x) => x.id === "kcal-encaja");
    expect(kcal).toBeDefined();
    // 400 + 500 = 900; 1850 - 900 = 950.
    expect(kcal!.texto).toContain("950");
  });

  it("pasarse del objetivo sale como atención, con cuánto", () => {
    const s = leerComida(
      { kcal: 900, proteinaG: 30, carbsG: 90, grasaG: 40 },
      ctx({ consumido: { kcal: 1300, proteinaG: 90, carbsG: 100, grasaG: 50 } }),
    );
    const kcal = s.find((x) => x.id === "kcal-excedido");
    expect(kcal?.tono).toBe("atencion");
    // 1300 + 900 = 2200; 2200 - 1850 = 350.
    expect(kcal!.texto).toContain("350");
  });

  it("el 5 % de margen no cuenta como pasarse", () => {
    // 1900 sobre 1850 es un 2.7 %: dentro del margen que usa el resto de la app.
    const s = leerComida(
      { kcal: 600, proteinaG: 45, carbsG: 50, grasaG: 20 },
      ctx({ consumido: { kcal: 1300, proteinaG: 100, carbsG: 90, grasaG: 45 }, momento: "cena" }),
    );
    expect(ids(s)).not.toContain("kcal-excedido");
  });

  it("avisa cuando queda poco para las comidas que faltan", () => {
    // Desayuno enorme: quedan dos comidas y muy pocas calorías.
    const s = leerComida(
      { kcal: 1400, proteinaG: 60, carbsG: 150, grasaG: 50 },
      ctx({ momento: "desayuno" }),
    );
    const kcal = s.find((x) => x.id === "kcal-justo");
    expect(kcal?.tono).toBe("atencion");
    expect(kcal!.texto).toContain("2 comidas");
  });
});

describe("proteína", () => {
  it("celebra un buen aporte y dice en cuánto va el día", () => {
    const s = leerComida(
      { kcal: 450, proteinaG: 45, carbsG: 20, grasaG: 15 },
      ctx({ consumido: { kcal: 400, proteinaG: 30, carbsG: 40, grasaG: 12 } }),
    );
    const p = s.find((x) => x.id === "proteina-buena");
    expect(p?.tono).toBe("bien");
    expect(p!.texto).toContain("75"); // 30 + 45
    expect(p!.texto).toContain("160");
  });

  it("señala calorías altas con proteína baja, y sugiere qué agregar", () => {
    const s = leerComida(
      { kcal: 520, proteinaG: 6, carbsG: 90, grasaG: 14 },
      ctx(),
    );
    const p = s.find((x) => x.id === "proteina-floja");
    expect(p?.tono).toBe("atencion");
    // La sugerencia tiene que ser accionable, no "comé más proteína".
    expect(p!.texto).toMatch(/huevo|atún|pollo|queso/);
  });

  it("no regaña por lo que falta si esta comida ya aportó bien", () => {
    // Un almuerzo con 46 g de proteína está bien hecho. Decirle "todavía te
    // faltan 82 g" de primero convierte un acierto en un reproche, y el número
    // que falta ya sale en la señal de que va bien.
    const s = leerComida(
      { kcal: 520, proteinaG: 46, carbsG: 40, grasaG: 16 },
      ctx({ consumido: { kcal: 430, proteinaG: 32, carbsG: 45, grasaG: 13 } }),
    );
    expect(ids(s)).not.toContain("proteina-cuesta-arriba");
    expect(ids(s)).toContain("proteina-buena");
    expect(s[0].tono).not.toBe("atencion");
  });

  it("pero sí avisa cuando la comida aportó poco y falta mucho", () => {
    const s = leerComida(
      { kcal: 640, proteinaG: 7, carbsG: 105, grasaG: 18 },
      ctx({ consumido: { kcal: 430, proteinaG: 32, carbsG: 45, grasaG: 13 } }),
    );
    expect(ids(s)).toContain("proteina-cuesta-arriba");
  });

  it("una comida chica con poca proteína no dispara nada", () => {
    // Un café con leche no merece un sermón.
    const s = leerComida({ kcal: 120, proteinaG: 4, carbsG: 12, grasaG: 6 }, ctx());
    expect(ids(s)).not.toContain("proteina-floja");
  });

  it("en la cena avisa si el día va a cerrar corto de proteína", () => {
    const s = leerComida(
      { kcal: 500, proteinaG: 20, carbsG: 60, grasaG: 18 },
      ctx({
        momento: "cena",
        consumido: { kcal: 900, proteinaG: 60, carbsG: 100, grasaG: 35 },
      }),
    );
    const p = s.find((x) => x.id === "proteina-ultima");
    expect(p?.tono).toBe("atencion");
    expect(p!.texto).toContain("80"); // 160 - (60 + 20)
  });

  it("no avisa de falta si la comida ya cubrió el objetivo", () => {
    const s = leerComida(
      { kcal: 600, proteinaG: 70, carbsG: 30, grasaG: 20 },
      ctx({
        momento: "cena",
        consumido: { kcal: 900, proteinaG: 100, carbsG: 100, grasaG: 35 },
      }),
    );
    expect(ids(s)).not.toContain("proteina-ultima");
    expect(s.find((x) => x.id === "proteina-buena")!.texto).toContain("cubriste");
  });
});

describe("de dónde vienen las calorías", () => {
  it("mucha grasa se dice como dato, no como reproche", () => {
    const s = leerComida(
      { kcal: 400, proteinaG: 8, carbsG: 10, grasaG: 35 },
      ctx({ consumido: { kcal: 600, proteinaG: 50, carbsG: 60, grasaG: 20 } }),
      5,
    );
    const g = s.find((x) => x.id === "mucha-grasa");
    expect(g?.tono).toBe("info");
    expect(g!.texto).toContain("No es un problema en sí");
  });

  it("casi todo carbohidrato con poca proteína se señala", () => {
    const s = leerComida(
      { kcal: 400, proteinaG: 5, carbsG: 85, grasaG: 3 },
      ctx({ consumido: { kcal: 600, proteinaG: 50, carbsG: 60, grasaG: 20 } }),
      5,
    );
    expect(ids(s)).toContain("muchos-carbos");
  });
});

describe("cuántas y en qué orden", () => {
  it("lo que pide acción va primero", () => {
    const s = leerComida(
      { kcal: 900, proteinaG: 5, carbsG: 120, grasaG: 40 },
      ctx({ consumido: { kcal: 1400, proteinaG: 40, carbsG: 150, grasaG: 60 } }),
    );
    expect(s[0].tono).toBe("atencion");
  });

  it("nunca devuelve más de tres", () => {
    // Una lista larga de observaciones tibias no se lee, y la que importa se
    // pierde entre las demás.
    const s = leerComida(
      { kcal: 900, proteinaG: 3, carbsG: 200, grasaG: 10 },
      ctx({ consumido: { kcal: 1500, proteinaG: 20, carbsG: 180, grasaG: 60 } }),
    );
    expect(s.length).toBeLessThanOrEqual(3);
  });
});
