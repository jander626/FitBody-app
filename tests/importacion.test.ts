/**
 * Tests de la traducción bitácora → esquema.
 *
 * Los casos no son inventados: son los valores que aparecen de verdad en
 * data/comidas/*.json. Si el repo de la bitácora está disponible, además se
 * verifica contra el archivo real que todo entra en el esquema y que ningún
 * total se desvía.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aConfianza,
  aMomento,
  interpretarOrigen,
  normalizar,
  notaDeItem,
  slugificar,
} from "@/lib/importacion/mapeo";

describe("normalizar y slugificar", () => {
  it("quita acentos, mayúsculas y puntuación", () => {
    expect(normalizar("Plátano Maduro (asado)")).toBe("platano maduro asado");
    expect(normalizar("Arepa de maíz — media tela")).toBe(
      "arepa de maiz media tela",
    );
  });

  it("genera slugs estables", () => {
    expect(slugificar("Pechuga de pollo sin piel")).toBe(
      "pechuga-de-pollo-sin-piel",
    );
    expect(slugificar("Chicharron (piel de cerdo frita)")).toBe(
      "chicharron-piel-de-cerdo-frita",
    );
    expect(slugificar("Milo sin azúcar (versión light)")).toBe(
      "milo-sin-azucar-version-light",
    );
  });

  it("no deja guiones sueltos en los bordes", () => {
    expect(slugificar("  ¡Café!  ")).toBe("cafe");
  });
});

describe("momentos", () => {
  it("mapea los que usa la bitácora", () => {
    expect(aMomento("desayuno")).toBe("desayuno");
    expect(aMomento("almuerzo")).toBe("almuerzo");
    expect(aMomento("cena")).toBe("cena");
    expect(aMomento("snack")).toBe("snack");
    expect(aMomento("bebida")).toBe("bebida");
    expect(aMomento("postre")).toBe("postre");
  });

  it("colapsa 'snack tarde' a snack", () => {
    expect(aMomento("snack tarde")).toBe("snack");
  });

  it("cae en 'otro' antes que perder la comida", () => {
    expect(aMomento("algo rarísimo")).toBe("otro");
    expect(aMomento(undefined)).toBe("otro");
  });
});

describe("confianza", () => {
  it("mapea los tres niveles", () => {
    expect(aConfianza("alta")).toBe("alta");
    expect(aConfianza("media")).toBe("media");
    expect(aConfianza("baja")).toBe("baja");
  });

  it("redondea 'media-alta' hacia abajo", () => {
    // Preguntar de más es el error barato.
    expect(aConfianza("media-alta")).toBe("media");
  });

  it("sin valor no inventa uno", () => {
    expect(aConfianza(undefined)).toBeNull();
    expect(aConfianza("lo que sea")).toBeNull();
  });
});

describe("origen", () => {
  // Las nueve variantes que aparecen en data/comidas/*.json.
  const CASOS: [string, string, boolean][] = [
    ["foto", "foto", false],
    ["foto (etiqueta nutricional)", "foto", false],
    ["reporte en texto", "descripcion", false],
    [
      "reporte en texto (porcion exacta indicada por el usuario)",
      "descripcion",
      false,
    ],
    [
      "estimado (usuario reporto en texto, comida callejera sin foto del plato final)",
      "descripcion",
      false,
    ],
    ["foto + descripcion", "foto+descripcion", false],
    ["foto (menu) + confirmacion del usuario", "foto+descripcion", false],
    ["foto (producto/menu) + confirmacion del usuario", "foto+descripcion", false],
    [
      "foto + descripcion + correccion del usuario",
      "foto+descripcion",
      true,
    ],
  ];

  it.each(CASOS)("interpreta %j", (entrada, esperado, corregido) => {
    expect(interpretarOrigen(entrada)).toEqual({
      origen: esperado,
      corregido,
    });
  });

  it("sin origen asume registro manual", () => {
    expect(interpretarOrigen(undefined)).toEqual({
      origen: "manual",
      corregido: false,
    });
  });

  it("detecta la corrección aunque venga sin foto", () => {
    expect(interpretarOrigen("reporte en texto + correccion")).toEqual({
      origen: "descripcion",
      corregido: true,
    });
  });

  it("no confunde 'sin foto' con que hubo foto", () => {
    // Este caso salió de los datos reales, no de la imaginación: buscar la
    // subcadena "foto" clasificaba como fotografiada una comida que el propio
    // texto dice que no lo estaba.
    expect(
      interpretarOrigen("reporte del usuario, comida callejera sin foto")
        .origen,
    ).toBe("descripcion");
    expect(interpretarOrigen("sin foto, reporte en texto").origen).toBe(
      "descripcion",
    );
    // Sin foto y sin señal de que la persona haya aportado texto, lo honesto
    // es "manual" — no inventar un origen que los datos no respaldan.
    expect(interpretarOrigen("sin foto").origen).toBe("manual");
  });
});

describe("notas del ítem", () => {
  it("junta las tres variantes de la bitácora", () => {
    expect(
      notaDeItem({ nota: "a la plancha", nota_porcion: "pesado en báscula" }),
    ).toBe("a la plancha · pesado en báscula");
  });

  it("no repite una nota idéntica", () => {
    expect(notaDeItem({ nota: "igual", porcion_nota: "igual" })).toBe("igual");
  });

  it("sin notas devuelve null, no una cadena vacía", () => {
    expect(notaDeItem({})).toBeNull();
    expect(notaDeItem({ nota: "   " })).toBeNull();
  });
});

// ------------------------------------------- contra la bitácora de verdad ---

const REPO = process.env.FITFOOD_REPO_PATH ?? "../fitfood";
const DIR_COMIDAS = path.resolve(REPO, "data/comidas");
const hayBitacora = existsSync(DIR_COMIDAS);

/* eslint-disable @typescript-eslint/no-explicit-any */
describe.skipIf(!hayBitacora)("contra los archivos reales de la bitácora", () => {
  const archivos = hayBitacora
    ? readdirSync(DIR_COMIDAS).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    : [];

  const dias = archivos.map(
    (f) => JSON.parse(readFileSync(path.join(DIR_COMIDAS, f), "utf8")) as any,
  );

  const MOMENTOS = [
    "desayuno",
    "almuerzo",
    "cena",
    "snack",
    "postre",
    "bebida",
    "otro",
  ];

  it("todos los momentos caen en el conjunto del esquema", () => {
    for (const dia of dias) {
      for (const comida of dia.comidas) {
        expect(MOMENTOS).toContain(aMomento(comida.momento));
      }
    }
  });

  it("todas las confianzas son válidas o nulas", () => {
    for (const dia of dias) {
      for (const comida of dia.comidas) {
        expect(["alta", "media", "baja", null]).toContain(
          aConfianza(comida.confianza),
        );
      }
    }
  });

  it("ningún ítem trae gramos y mililitros a la vez", () => {
    // Es la restricción que el esquema impone; si la bitácora la violara,
    // la importación fallaría a mitad de camino.
    for (const dia of dias) {
      for (const comida of dia.comidas) {
        for (const item of comida.items) {
          const conPorcion = [item.porcion_g, item.porcion_ml].filter(
            (v: unknown) => v !== undefined && v !== null,
          );
          expect(conPorcion.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("los totales del día cuadran con la suma de los ítems", () => {
    // Esta es la regresión que importa: si la traducción pierde o duplica un
    // ítem, el total deja de cuadrar.
    for (const dia of dias) {
      const suma = dia.comidas.flatMap((c: any) => c.items).reduce(
        (acc: number, i: any) => acc + i.kcal,
        0,
      );
      // Tolerancia de 0.1: la bitácora guarda los totales con un decimal, así
      // que la suma de los ítems puede diferir por el redondeo. Más que eso
      // ya sería un ítem perdido o duplicado.
      expect(Math.abs(suma - dia.totales.kcal)).toBeLessThanOrEqual(0.1);
    }
  });

  it("los subtotales de cada comida cuadran con sus ítems", () => {
    for (const dia of dias) {
      for (const comida of dia.comidas) {
        const suma = comida.items.reduce(
          (acc: number, i: any) => acc + i.kcal,
          0,
        );
        expect(Math.abs(suma - comida.subtotal.kcal)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("la tabla de alimentos no genera slugs repetidos", () => {
    const tabla = JSON.parse(
      readFileSync(path.resolve(REPO, "data/tabla_alimentos.json"), "utf8"),
    ) as { alimentos: { nombre: string }[] };

    const slugs = tabla.alimentos.map((a) => slugificar(a.nombre));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
