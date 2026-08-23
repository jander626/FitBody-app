import { describe, expect, it } from "vitest";
import {
  buscarAlimentos,
  macrosDePorcion,
  porcionSugerida,
  type Alimento,
} from "@/lib/alimentos";

/** Alimentos reales de la tabla de la bitácora. */
function alimento(
  nombre: string,
  categoria: string,
  kcal100: number,
  p100: number,
  c100: number,
  g100: number,
  porcionG: number | null = null,
): Alimento {
  return {
    id: nombre,
    slug: nombre,
    nombre,
    categoria,
    kcal100,
    p100,
    c100,
    g100,
    porcionG,
    porcionNota: null,
  };
}

const TABLA: Alimento[] = [
  alimento("Pechuga de pollo sin piel", "Proteina animal", 165, 31, 0, 3.6, 200),
  alimento("Muslo de pollo con piel", "Proteina animal", 209, 26, 0, 11, 150),
  alimento("Arepa de maiz (media tela)", "Carbohidrato / tuberculo", 200, 4, 42, 2, 50),
  alimento("Arroz blanco cocido", "Carbohidrato / tuberculo", 130, 2.4, 28, 0.3, 150),
  alimento("Aguacate", "Verdura", 160, 2, 9, 15, 50),
  alimento("Huevo entero (frito/revuelto)", "Huevos y lacteos", 155, 13, 1.5, 11, 50),
  alimento("Platano maduro frito (tajadas)", "Carbohidrato / tuberculo", 220, 1.3, 40, 7, 100),
];

describe("macros de una porción", () => {
  it("multiplica desde los valores por 100 g", () => {
    // 200 g de pechuga: la porción típica de la tabla.
    expect(macrosDePorcion(TABLA[0], 200)).toEqual({
      kcal: 330,
      proteinaG: 62,
      carbsG: 0,
      grasaG: 7.2,
    });
  });

  it("una arepa de media tela pesada en báscula da los números de la bitácora", () => {
    expect(macrosDePorcion(TABLA[2], 50)).toEqual({
      kcal: 100,
      proteinaG: 2,
      carbsG: 21,
      grasaG: 1,
    });
  });

  it("escala a cualquier porción, no solo a la típica", () => {
    expect(macrosDePorcion(TABLA[3], 75)).toEqual({
      kcal: 97.5,
      proteinaG: 1.8,
      carbsG: 21,
      grasaG: 0.2,
    });
  });

  it("una porción de cero da cero, no NaN", () => {
    expect(macrosDePorcion(TABLA[0], 0)).toEqual({
      kcal: 0,
      proteinaG: 0,
      carbsG: 0,
      grasaG: 0,
    });
  });

  it("redondea a un decimal: más precisión sería fingida", () => {
    const m = macrosDePorcion(TABLA[4], 37);
    expect(m.kcal).toBe(59.2);
    expect(m.grasaG).toBe(5.6);
  });
});

describe("buscador", () => {
  it("encuentra por prefijo", () => {
    expect(buscarAlimentos(TABLA, "arep")[0].nombre).toBe(
      "Arepa de maiz (media tela)",
    );
  });

  it("ignora acentos y mayúsculas", () => {
    expect(buscarAlimentos(TABLA, "PLÁTANO")[0].nombre).toBe(
      "Platano maduro frito (tajadas)",
    );
  });

  it("acepta las palabras en cualquier orden", () => {
    // Uno escribe lo que recuerda primero, no el nombre exacto de la tabla.
    const r = buscarAlimentos(TABLA, "pollo pechuga");
    expect(r[0].nombre).toBe("Pechuga de pollo sin piel");
  });

  it("busca también por categoría", () => {
    const r = buscarAlimentos(TABLA, "verdura");
    expect(r.map((a) => a.nombre)).toContain("Aguacate");
  });

  it("prioriza el nombre más corto ante igual relevancia", () => {
    const r = buscarAlimentos(TABLA, "pollo");
    expect(r[0].nombre).toBe("Muslo de pollo con piel");
  });

  it("sin consulta devuelve la tabla, no nada", () => {
    // La pantalla arranca mostrando alimentos, no un vacío.
    expect(buscarAlimentos(TABLA, "").length).toBe(TABLA.length);
    expect(buscarAlimentos(TABLA, "   ").length).toBe(TABLA.length);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(buscarAlimentos(TABLA, "sushi")).toEqual([]);
  });

  it("respeta el límite", () => {
    expect(buscarAlimentos(TABLA, "", 3).length).toBe(3);
  });
});

describe("porción sugerida", () => {
  it("usa la porción típica de la tabla", () => {
    expect(porcionSugerida(TABLA[0])).toBe(200);
  });

  it("cae en 100 g cuando la tabla no trae una", () => {
    expect(porcionSugerida(alimento("X", "Y", 100, 1, 1, 1, null))).toBe(100);
  });
});
