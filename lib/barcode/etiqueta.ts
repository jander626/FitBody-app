/**
 * La tabla nutricional de un empaque: qué devuelve el modelo, cómo se pasa a
 * "por 100 g" y qué se puede desconfiar.
 *
 * Módulo puro. Quien llama al modelo es `lib/vision/etiqueta.ts`; acá solo está
 * lo que se puede probar sin una foto: el esquema, la conversión y las
 * comprobaciones.
 *
 * Las etiquetas colombianas casi siempre traen los valores POR PORCIÓN ("Tamaño
 * de porción 30 g"), y a veces también por 100 g. El motor de la app trabaja
 * siempre en 100 g, así que la conversión es el centro de todo esto: un error
 * acá multiplica o divide cada comida futura con ese producto.
 */
import { z } from "zod";

/** A qué cantidad se refieren los valores de la columna que se leyó. */
export const BASES = ["100g", "100ml", "porcion"] as const;
export type Base = (typeof BASES)[number];

/**
 * Lo que el modelo devuelve. Los números van tal como están impresos en la
 * etiqueta, SIN convertir: convertir se hace acá, donde se puede probar, y no
 * en el modelo, que se equivoca en las divisiones.
 */
export const EtiquetaSchema = z.object({
  legible: z
    .boolean()
    .describe(
      "false si en la foto no se ve una tabla nutricional o no se pueden leer los números. true si se leyó.",
    ),
  nombre: z
    .string()
    .nullable()
    .describe("Nombre del producto si aparece en el empaque (con la marca). null si no se ve."),
  base: z
    .enum(BASES)
    .describe(
      "A qué cantidad se refieren los números que devuelves: '100g' o '100ml' si usaste la columna por 100, 'porcion' si usaste la columna por porción.",
    ),
  tamano_porcion: z
    .number()
    .nullable()
    .describe(
      "Tamaño de UNA porción en gramos o mililitros: el número del 'Tamaño de porción' (por ejemplo 30 en 'Tamaño de porción: 1 paquete (30 g)'). null si no aparece o si usaste la columna por 100.",
    ),
  kcal: z.number().nullable().describe("Calorías (energía) en kcal, tal como están impresas. Si solo hay kJ, divide entre 4,184."),
  proteina_g: z.number().nullable().describe("Proteína en gramos."),
  carbohidratos_g: z.number().nullable().describe("Carbohidratos totales en gramos."),
  grasa_g: z.number().nullable().describe("Grasa total en gramos."),
});

export type EtiquetaCruda = z.infer<typeof EtiquetaSchema>;

/** Valores de una etiqueta, en la base en que se leyeron. */
export interface ValoresEtiqueta {
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
}

export interface Por100 {
  kcal100: number;
  p100: number;
  c100: number;
  g100: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Pasa valores leídos a "por 100".
 *
 * Con `100g` y `100ml` ya están en base 100. Con `porcion` hace falta el tamaño
 * de la porción: sin él (o con uno imposible) devuelve null, porque inventar un
 * tamaño sería inventar el producto.
 */
export function aPor100(valores: ValoresEtiqueta, base: Base, tamano: number | null): Por100 | null {
  let factor = 1;
  if (base === "porcion") {
    if (tamano === null || !Number.isFinite(tamano) || tamano <= 0 || tamano > 2000) return null;
    factor = 100 / tamano;
  }
  return {
    kcal100: Math.round(valores.kcal * factor),
    p100: r1(valores.proteinaG * factor),
    c100: r1(valores.carbsG * factor),
    g100: r1(valores.grasaG * factor),
  };
}

export interface Revision {
  /** Lo que impide guardar: valores imposibles. */
  errores: string[];
  /** Lo que conviene mirar pero no bloquea: puede estar bien. */
  avisos: string[];
}

/**
 * Qué tan creíble es lo que hay en el formulario.
 *
 * Una etiqueta no se equivoca, pero la lectura sí, y también quien teclea. Por
 * eso hay dos niveles: lo imposible (más de 100 g de macros en 100 g de
 * producto) no se guarda; lo raro (las calorías no cuadran con los macros) se
 * muestra y se deja decidir, porque las etiquetas redondean, los polioles y la
 * fibra mueven las cuentas, y bloquear sería peor que avisar.
 */
export function revisarPor100(v: Por100): Revision {
  const errores: string[] = [];
  const avisos: string[] = [];

  const campos: [string, number, number][] = [
    ["Las calorías", v.kcal100, 900],
    ["La proteína", v.p100, 100],
    ["Los carbohidratos", v.c100, 100],
    ["La grasa", v.g100, 100],
  ];
  for (const [nombre, valor, tope] of campos) {
    if (!Number.isFinite(valor) || valor < 0) errores.push(`${nombre} tiene que ser un número de cero en adelante.`);
    else if (valor > tope) {
      errores.push(
        tope === 900
          ? "Más de 900 kcal por 100 g no existe: revisa si copiaste las calorías de toda la porción."
          : `${nombre} no puede pasar de 100 g por cada 100 g. Revisa el tamaño de la porción.`,
      );
    }
  }

  if (errores.length === 0) {
    if (v.p100 + v.c100 + v.g100 > 105) {
      errores.push("Los macros suman más de 100 g por cada 100 g. Revisa el tamaño de la porción.");
    } else {
      const porMacros = 4 * v.p100 + 4 * v.c100 + 9 * v.g100;
      if (Math.abs(v.kcal100 - porMacros) > Math.max(40, v.kcal100 * 0.25)) {
        avisos.push(
          `Las calorías (${v.kcal100}) no cuadran con los macros (que suman unas ${Math.round(porMacros)}). Puede estar bien, pero compara con la etiqueta.`,
        );
      }
    }
  }

  return { errores, avisos };
}

/** Un número leído por el modelo, o null si no sirve (NaN, negativo, absurdo). */
function numeroOk(n: unknown, tope: number): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= tope ? n : null;
}

/** Lo que devolvió el modelo, ya saneado para llenar el formulario. */
export interface Lectura {
  legible: boolean;
  nombre: string;
  base: Base;
  tamano: number | null;
  kcal: number | null;
  proteinaG: number | null;
  carbsG: number | null;
  grasaG: number | null;
}

export function sanearLectura(cruda: EtiquetaCruda): Lectura {
  const nombre = (cruda.nombre ?? "").trim().slice(0, 120);
  return {
    legible: cruda.legible,
    nombre,
    base: cruda.base,
    tamano: cruda.base === "porcion" ? numeroOk(cruda.tamano_porcion, 2000) : null,
    kcal: numeroOk(cruda.kcal, 5000),
    proteinaG: numeroOk(cruda.proteina_g, 1000),
    carbsG: numeroOk(cruda.carbohidratos_g, 1000),
    grasaG: numeroOk(cruda.grasa_g, 1000),
  };
}

/** Todos los valores que hacen falta para guardar el producto. */
export function estaCompleta(l: Lectura): boolean {
  return (
    l.kcal !== null &&
    l.proteinaG !== null &&
    l.carbsG !== null &&
    l.grasaG !== null &&
    (l.base !== "porcion" || (l.tamano !== null && l.tamano > 0))
  );
}
