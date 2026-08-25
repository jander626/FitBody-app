/**
 * Tests del lector de CSV de Garmin.
 *
 * Los fixtures son exports reales, sin retocar: BOM incluido, "--" incluido,
 * y con los dos formatos de fecha que Garmin mezcla en un mismo conjunto de
 * archivos. Un parser probado contra CSV inventados por mí no probaría nada,
 * porque yo inventaría el CSV que mi parser sabe leer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aFechaISO,
  aHoras,
  detectarMetrica,
  fusionar,
  leerCsv,
  partirLinea,
} from "@/lib/garmin/csv";

const DIR = path.join(__dirname, "ayudas", "garmin");
const leer = (n: string) => readFileSync(path.join(DIR, n), "utf8");

const PASOS_A = "pasos-2026-07-15_2026-08-09.csv";
const PASOS_B = "pasos-2026-07-27_2026-08-23.csv";
const SUENO_A = "sueno-2026-07-15_2026-08-11.csv";
const SUENO_B = "sueno-2026-07-27_2026-08-23.csv";
const ACTIVIDADES = "actividades-2026-08-02_2026-08-16.csv";

describe("partir líneas de CSV", () => {
  it("separa por comas", () => {
    expect(partirLinea("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("respeta las comas dentro de comillas", () => {
    expect(partirLinea('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("entiende la comilla escapada", () => {
    expect(partirLinea('a,"di ""hola""",b')).toEqual(['a', 'di "hola"', "b"]);
  });

  it("conserva los campos vacíos", () => {
    // Si se cayera un vacío, todas las columnas siguientes se correrían.
    expect(partirLinea("a,,c")).toEqual(["a", "", "c"]);
  });
});

describe("fechas", () => {
  it("acepta la ISO del informe de sueño", () => {
    expect(aFechaISO("2026-08-23")).toBe("2026-08-23");
  });

  it("convierte la MM/DD/YYYY del informe de pasos", () => {
    expect(aFechaISO("08/02/2026")).toBe("2026-08-02");
    expect(aFechaISO("7/15/2026")).toBe("2026-07-15");
  });

  it("no adivina cuando el primer número no puede ser un mes", () => {
    // 15/07 sería DD/MM. Adivinar convertiría días en meses en silencio.
    expect(aFechaISO("15/07/2026")).toBeUndefined();
  });

  it("los huecos no son fechas", () => {
    expect(aFechaISO("--")).toBeUndefined();
    expect(aFechaISO("")).toBeUndefined();
  });
});

describe("duración del sueño", () => {
  it("lee el formato de Garmin", () => {
    expect(aHoras("6h 58min")).toBe(6.97);
    expect(aHoras("8h 0min")).toBe(8);
  });

  it("lee horas sin minutos", () => {
    expect(aHoras("7h")).toBe(7);
  });

  it("acepta reloj y decimal", () => {
    expect(aHoras("6:30")).toBe(6.5);
    expect(aHoras("6,5")).toBe(6.5);
  });

  it("un hueco no es cero horas", () => {
    // Cero horas de sueño es un dato; "no midió" no lo es.
    expect(aHoras("--")).toBeUndefined();
  });
});

describe("detectar qué informe es cada archivo", () => {
  it("reconoce el de sueño por la cabecera", () => {
    expect(detectarMetrica(leer(SUENO_A), SUENO_A)).toBe("sueno");
  });

  it("reconoce el de actividades", () => {
    expect(detectarMetrica(leer(ACTIVIDADES), ACTIVIDADES)).toBe("actividades");
  });

  it("distingue pasos de calorías por el nombre del archivo", () => {
    // Garmin les da la MISMA cabecera: ",Actuales,Objetivo".
    const texto = leer(PASOS_A);
    expect(detectarMetrica(texto, "pasos-2026.csv")).toBe("pasos");
    expect(detectarMetrica(texto, "calorias-2026.csv")).toBe("calorias");
  });

  it("no adivina cuando el nombre no dice nada", () => {
    expect(detectarMetrica(leer(PASOS_A), "export (3).csv")).toBeNull();
  });

  it("un archivo que no es de Garmin no se reconoce", () => {
    expect(detectarMetrica("hola\nmundo", "cosas.csv")).toBeNull();
  });
});

describe("leer el informe de pasos", () => {
  const r = leerCsv(leer(PASOS_A), "pasos");

  it("lee todas las filas", () => {
    // Del 15/07 al 09/08 inclusive. El archivo no termina en salto de línea,
    // así que `wc -l` dice una menos de las que hay.
    expect(r.dias.length).toBe(26);
    expect(r.dias.at(-1)!.fecha).toBe("2026-08-09");
    expect(r.ignoradas).toBe(0);
  });

  it("el BOM no se come la primera fila", () => {
    expect(r.dias[0]).toEqual({
      fecha: "2026-07-15",
      pasos: 6239,
      pasosObjetivo: 8800,
    });
  });
});

describe("leer el informe de sueño", () => {
  const r = leerCsv(leer(SUENO_B), "sueno");

  it("mapea las columnas por nombre, no por posición", () => {
    const d = r.dias.find((x) => x.fecha === "2026-08-23")!;
    expect(d).toEqual({
      fecha: "2026-08-23",
      suenoPuntuacion: 77,
      fcReposo: 54,
      bodyBattery: 67,
      suenoCalidad: "Aceptable",
      suenoHoras: 6.72, // 6h 43min
    });
  });

  it("una noche sin datos no inventa ceros", () => {
    const d = leerCsv(leer(SUENO_A), "sueno").dias.find(
      (x) => x.fecha === "2026-08-11",
    )!;
    expect(d.suenoHoras).toBe(8);
    expect(d.fcReposo).toBeUndefined();
    expect(d.bodyBattery).toBeUndefined();
  });

  it("una fila con fecha y nada más se descarta", () => {
    // El 10 de agosto está entero en "--".
    const r2 = leerCsv(leer(SUENO_A), "sueno");
    expect(r2.dias.some((x) => x.fecha === "2026-08-10")).toBe(false);
    expect(r2.ignoradas).toBeGreaterThan(0);
  });
});

describe("fusionar informes que se solapan", () => {
  const dias = fusionar([
    leerCsv(leer(PASOS_A), "pasos"),
    leerCsv(leer(PASOS_B), "pasos"),
    leerCsv(leer(SUENO_A), "sueno"),
    leerCsv(leer(SUENO_B), "sueno"),
  ]);

  it("un día es una fila, aunque venga en cuatro archivos", () => {
    const fechas = dias.map((d) => d.fecha);
    expect(new Set(fechas).size).toBe(fechas.length);
  });

  it("junta pasos y sueño del mismo día", () => {
    const d = dias.find((x) => x.fecha === "2026-08-09")!;
    expect(d.pasos).toBeGreaterThan(0);
    expect(d.fcReposo).toBe(55);
  });

  it("cubre el rango completo de los cuatro archivos", () => {
    expect(dias.at(-1)!.fecha).toBe("2026-07-15");
    expect(dias[0].fecha).toBe("2026-08-23");
  });

  it("viene del más nuevo al más viejo", () => {
    const fechas = dias.map((d) => d.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it("un dato presente nunca lo pisa un ausente", () => {
    // El archivo de sueño viejo llega hasta el 11; el nuevo arranca el 27 de
    // julio. Los días de agosto que solo trae el viejo tienen que sobrevivir.
    const d = dias.find((x) => x.fecha === "2026-07-15")!;
    expect(d.pasos).toBe(6239);
  });
});

describe("informe de actividades", () => {
  it("se lee sin romper, pero no aporta filas de día", () => {
    // Es un conteo por tipo de actividad: no hay nada que poner en la fila.
    const r = leerCsv(leer(ACTIVIDADES), "actividades");
    expect(r.dias).toEqual([]);
    expect(r.ignoradas).toBeGreaterThan(0);
  });
});
