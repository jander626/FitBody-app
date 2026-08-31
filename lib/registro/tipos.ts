import { z } from "zod";

/**
 * Un ítem en la tarjeta de revisión, antes de guardarse.
 *
 * Es la misma forma venga del buscador manual o de la estimación de la IA: la
 * tarjeta editable es idéntica en los dos casos, y así el guardado es uno solo.
 */
export const ItemBorradorSchema = z.object({
  /** Null cuando el alimento no está en la tabla (texto libre). */
  foodId: z.string().uuid().nullable(),
  alimento: z.string().min(1).max(300),
  porcionG: z.number().positive().max(10000).nullable(),
  porcionMl: z.number().positive().max(10000).nullable(),
  kcal: z.number().min(0).max(20000),
  proteinaG: z.number().min(0).max(2000),
  carbsG: z.number().min(0).max(2000),
  grasaG: z.number().min(0).max(2000),
  nota: z.string().max(1000).nullable(),
});

export type ItemBorrador = z.infer<typeof ItemBorradorSchema>;

export const MOMENTOS = [
  "desayuno",
  "almuerzo",
  "cena",
  "snack",
  "postre",
  "bebida",
  "otro",
] as const;

export const NOMBRE_MOMENTO: Record<(typeof MOMENTOS)[number], string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  snack: "Snack",
  postre: "Postre",
  bebida: "Bebida",
  otro: "Otro",
};

export const ComidaBorradorSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  momento: z.enum(MOMENTOS),
  origen: z.enum(["foto", "descripcion", "foto+descripcion", "manual"]),
  confianza: z.enum(["alta", "media", "baja"]).nullable(),
  corregido: z.boolean(),
  nota: z.string().max(2000).nullable(),
  scanSessionId: z.string().uuid().nullable(),
  items: z.array(ItemBorradorSchema).min(1).max(40),
});

export type ComidaBorrador = z.infer<typeof ComidaBorradorSchema>;

/**
 * Calorías y macros de un conjunto de ítems.
 *
 * Vive acá, en el módulo puro, y no en `lib/datos/diario` —que es server-only—
 * porque lo necesitan también las señales del registro, que corren en el
 * navegador. Una sola definición: el diario la reexporta.
 */
export interface Totales {
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
}

/** Suma de los ítems. La misma cuenta en el borrador y en el diario. */
export function totalesDeItems(items: ItemBorrador[]): Totales {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      proteinaG: acc.proteinaG + i.proteinaG,
      carbsG: acc.carbsG + i.carbsG,
      grasaG: acc.grasaG + i.grasaG,
    }),
    { kcal: 0, proteinaG: 0, carbsG: 0, grasaG: 0 },
  );
}

/**
 * Momento probable según la hora, para no obligar a elegirlo cada vez.
 * Los cortes siguen los horarios de comida en Colombia.
 */
export function momentoSugerido(hora: number): (typeof MOMENTOS)[number] {
  if (hora < 11) return "desayuno";
  if (hora < 15) return "almuerzo";
  if (hora < 18) return "snack";
  return "cena";
}
