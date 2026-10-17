import { describe, expect, it } from "vitest";
import {
  emojiDeAlimento,
  etapaDeEspera,
  porcentajeDeEspera,
  repartoDeEnergia,
  tituloDeComida,
} from "@/lib/registro/presentacion";

describe("emojiDeAlimento", () => {
  it("reconoce alimentos comunes, con tildes y mayúsculas", () => {
    expect(emojiDeAlimento("Arepa de maíz (media tela)")).toBe("🫓");
    expect(emojiDeAlimento("Huevos pericos")).toBe("🥚");
    expect(emojiDeAlimento("Queso mozzarella")).toBe("🧀");
    expect(emojiDeAlimento("Tocineta / bacon frita")).toBe("🥓");
    expect(emojiDeAlimento("Café con leche")).toBe("☕");
  });

  it("lo específico gana a lo general: la salchicha no es carne", () => {
    expect(emojiDeAlimento("Salchicha ranchera")).toBe("🌭");
    expect(emojiDeAlimento("Hamburguesa con queso")).toBe("🍔");
  });

  it("cae a un plato genérico cuando no reconoce nada", () => {
    expect(emojiDeAlimento("Xyzzy")).toBe("🍽️");
  });
});

describe("tituloDeComida", () => {
  const items = (...nombres: string[]) => nombres.map((alimento) => ({ alimento }));

  it("uno, dos y más de dos ingredientes", () => {
    expect(tituloDeComida(items("Arepa"))).toBe("Arepa");
    expect(tituloDeComida(items("Arepa", "Queso"))).toBe("Arepa y queso");
    expect(tituloDeComida(items("Arepa", "Queso", "Huevo", "Café"))).toBe("Arepa, queso y 2 más");
  });

  it("quita lo que va entre paréntesis", () => {
    expect(tituloDeComida(items("Pollo (a la plancha)", "Arroz blanco cocido"))).toBe("Pollo y arroz blanco cocido");
  });

  it("sin ingredientes da un título neutro", () => {
    expect(tituloDeComida([])).toBe("Tu comida");
  });
});

describe("repartoDeEnergia", () => {
  it("suma siempre 100", () => {
    for (const t of [
      { kcal: 429, proteinaG: 21, carbsG: 36, grasaG: 23 },
      { kcal: 1, proteinaG: 1, carbsG: 1, grasaG: 1 },
      { kcal: 700, proteinaG: 33, carbsG: 77, grasaG: 17 },
    ]) {
      const r = repartoDeEnergia(t);
      expect(r.proteina + r.carbs + r.grasa).toBe(100);
    }
  });

  it("refleja de dónde vienen las calorías", () => {
    // 21P·4=84, 38C·4=152, 31G·9=279 → 16 %, 29 %, 54 %
    expect(repartoDeEnergia({ kcal: 515, proteinaG: 21, carbsG: 38, grasaG: 31 })).toEqual({
      proteina: 16,
      carbs: 30,
      grasa: 54,
    });
  });

  it("sin macros no hay reparto", () => {
    expect(repartoDeEnergia({ kcal: 0, proteinaG: 0, carbsG: 0, grasaG: 0 })).toEqual({ proteina: 0, carbs: 0, grasa: 0 });
  });
});

describe("espera de una estimación", () => {
  it("el porcentaje sube sin retroceder y nunca llega solo al 100", () => {
    let previo = -1;
    for (const ms of [0, 500, 1000, 2000, 5000, 10000, 30000, 600000]) {
      const p = porcentajeDeEspera(ms);
      expect(p).toBeGreaterThanOrEqual(previo);
      expect(p).toBeLessThan(100);
      previo = p;
    }
    expect(porcentajeDeEspera(0)).toBe(0);
    expect(porcentajeDeEspera(-5)).toBe(0);
  });

  it("avanza rápido al principio y se frena", () => {
    const primeros = porcentajeDeEspera(2000) - porcentajeDeEspera(0);
    const siguientes = porcentajeDeEspera(12000) - porcentajeDeEspera(10000);
    expect(primeros).toBeGreaterThan(siguientes * 3);
  });

  it("la etapa cambia cada ~2,2 s y se queda en la última", () => {
    expect(etapaDeEspera(0, 3)).toBe(0);
    expect(etapaDeEspera(2300, 3)).toBe(1);
    expect(etapaDeEspera(4500, 3)).toBe(2);
    expect(etapaDeEspera(99999, 3)).toBe(2);
    expect(etapaDeEspera(5000, 0)).toBe(0);
  });
});
