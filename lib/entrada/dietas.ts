/**
 * Las formas de comer que se pueden elegir, y qué le hacen al reparto de macros.
 *
 * No cambian las calorías, que salen del gasto y del objetivo: cambian de dónde
 * vienen. Todas parten de los diales de la meta (proteína y grasa por kg) y
 * mueven solo lo que su nombre dice.
 *
 * Módulo puro.
 */
import type { DialesBase, OpcionesPlan } from "@/lib/nutrition";

export type Dieta = "recomendada" | "alta_proteina" | "baja_carbs" | "keto" | "baja_grasa";

export interface DefinicionDieta {
  id: Dieta;
  emoji: string;
  titulo: string;
  detalle: string;
  /** Un aviso que se muestra con el plan, para las que piden más cuidado. */
  aviso?: string;
  /** Los diales finales, partiendo de los de la meta. */
  opciones: (base: DialesBase) => OpcionesPlan;
}

/** Nadie necesita más proteína que esto; por encima solo cuesta más. */
const TOPE_PROTEINA = 2.6;

export const DIETAS: Record<Dieta, DefinicionDieta> = {
  recomendada: {
    id: "recomendada",
    emoji: "✨",
    titulo: "Recomendada",
    detalle: "La mejor para ti. Mezcla equilibrada de proteínas, carbohidratos y grasas.",
    opciones: (base) => base,
  },
  alta_proteina: {
    id: "alta_proteina",
    emoji: "🍗",
    titulo: "Alta en proteína",
    detalle: "Más proteínas, menos carbohidratos y grasas.",
    opciones: (base) => ({
      proteinaGPorKg: Math.min(TOPE_PROTEINA, base.proteinaGPorKg + 0.4),
      grasaGPorKg: 0.8,
    }),
  },
  baja_carbs: {
    id: "baja_carbs",
    emoji: "🥑",
    titulo: "Baja en carbohidratos",
    detalle: "Menos carbohidratos, más grasas y proteínas moderadas.",
    opciones: (base) => ({ ...base, carbsPct: 0.2 }),
  },
  keto: {
    id: "keto",
    emoji: "🫒",
    titulo: "Keto",
    detalle: "Muy baja en carbohidratos, alta en grasas y proteínas moderadas.",
    aviso:
      "La dieta keto es exigente y no es para todos. Si la vas a seguir más de unas semanas, coméntalo con un médico o nutricionista.",
    opciones: (base) => ({ ...base, carbsPct: 0.05 }),
  },
  baja_grasa: {
    id: "baja_grasa",
    emoji: "🥔",
    titulo: "Baja en grasas",
    detalle: "Menos grasas, más carbohidratos y proteínas moderadas.",
    // 0.6 g/kg es el mínimo fisiológico: más abajo se resiente lo hormonal.
    opciones: (base) => ({ ...base, grasaGPorKg: 0.6 }),
  },
};

export const ORDEN_DIETAS: Dieta[] = ["recomendada", "alta_proteina", "baja_carbs", "keto", "baja_grasa"];

/** Cuántas veces a la semana entrena fuerza. */
export type NivelFuerza = "ninguna" | "1-2" | "3-4" | "5+";

export const ORDEN_FUERZA: NivelFuerza[] = ["ninguna", "1-2", "3-4", "5+"];

/**
 * Cuánta proteína baja por kg según cuánta fuerza se entrena.
 *
 * La proteína alta existe para proteger el músculo que se estimula; con poco
 * estímulo hace falta menos. Con 3 o más sesiones por semana se mantiene lo de
 * la meta, y no se sube por entrenar más: más de lo que la meta ya pide cuesta
 * más y no rinde más.
 */
const AJUSTE_PROTEINA: Record<NivelFuerza, number> = {
  ninguna: -0.4,
  "1-2": -0.2,
  "3-4": 0,
  "5+": 0,
};

/**
 * Acepta también el sí/no de antes de que se preguntara por días: un sí era
 * "entrena lo suficiente" (lo de la meta) y un no era "no entrena".
 */
export function nivelDeFuerza(valor: boolean | NivelFuerza | undefined): NivelFuerza {
  if (valor === undefined || valor === true) return "3-4";
  if (valor === false) return "ninguna";
  return valor;
}

/** La proteína por kg tras ajustar por fuerza, sin bajar de 1,4 g/kg. */
export function proteinaSegunFuerza(base: number, fuerza: boolean | NivelFuerza | undefined): number {
  const ajuste = AJUSTE_PROTEINA[nivelDeFuerza(fuerza)];
  return ajuste === 0 ? base : Math.max(1.4, Math.round((base + ajuste) * 10) / 10);
}
