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

/**
 * Sin entrenar fuerza la proteína necesaria baja: se protege menos músculo
 * porque se está estimulando menos. Se resta 0.4 g/kg, sin bajar de 1.4.
 */
export function proteinaSegunFuerza(base: number, fuerza: boolean | undefined): number {
  return fuerza === false ? Math.max(1.4, Math.round((base - 0.4) * 10) / 10) : base;
}
