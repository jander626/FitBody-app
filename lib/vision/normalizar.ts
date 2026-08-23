/**
 * Normalización de la estimación contra la tabla de alimentos.
 *
 * Acá se aplica la regla central del sistema: **la IA estima qué y cuánto; la
 * tabla pone los números.** Cuando un ítem hace match con la tabla, sus macros
 * se recalculan con `kcal100 × g / 100` y se descarta lo que estimó el modelo.
 * Solo el texto libre conserva la estimación.
 *
 * Esto no es pedantería: los modelos son buenos reconociendo una arepa y
 * estimando que pesa 50 g, y mucho menos consistentes recordando que una arepa
 * tiene 200 kcal por 100 g. Se apoya a cada uno en lo que hace bien.
 *
 * Módulo puro para poder probarlo sin llamar a la API.
 */
import { macrosDePorcion, type Alimento } from "@/lib/alimentos";
import { normalizar as normalizarTexto } from "@/lib/texto";
import type { ItemBorrador } from "@/lib/registro/tipos";
import type { ItemEstimado } from "./esquema";

export interface ResultadoNormalizacion {
  items: ItemBorrador[];
  /** Cuántos ítems quedaron enlazados a la tabla. Telemetría de precisión. */
  enlazados: number;
}

/**
 * Convierte la estimación del modelo en ítems listos para el diario.
 *
 * El match se intenta primero por slug (que es lo que se le pidió devolver) y,
 * si ese slug no existe, por nombre normalizado. Lo segundo cubre el caso de
 * que el modelo invente un slug plausible pero equivocado, que pasa.
 */
export function normalizarEstimacion(
  estimados: ItemEstimado[],
  alimentos: Alimento[],
): ResultadoNormalizacion {
  const porSlug = new Map(alimentos.map((a) => [a.slug, a]));
  const porNombre = new Map(
    alimentos.map((a) => [normalizarTexto(a.nombre), a]),
  );

  let enlazados = 0;

  const items = estimados.map((est) => {
    const dellaTabla =
      (est.slug ? porSlug.get(est.slug) : undefined) ??
      porNombre.get(normalizarTexto(est.alimento));

    // Gramos y mililitros son excluyentes: la restricción de la tabla lo exige
    // y el modelo a veces devuelve los dos.
    let porcionG = est.porcion_g ?? null;
    let porcionMl = est.porcion_ml ?? null;
    if (porcionG !== null && porcionMl !== null) {
      // Ante ambos, mandan los gramos: es lo que la tabla sabe convertir.
      porcionMl = null;
    }
    if (porcionG !== null && porcionG <= 0) porcionG = null;
    if (porcionMl !== null && porcionMl <= 0) porcionMl = null;

    // Solo se recalcula si hay tabla Y una porción en gramos con la que
    // hacerlo. Con "3 huevos" sin gramos, la estimación del modelo es lo mejor
    // que hay.
    if (dellaTabla && porcionG !== null) {
      enlazados++;
      return {
        foodId: dellaTabla.id,
        alimento: dellaTabla.nombre,
        porcionG,
        porcionMl: null,
        nota: null,
        ...macrosDePorcion(dellaTabla, porcionG),
      } satisfies ItemBorrador;
    }

    if (dellaTabla) enlazados++;

    return {
      foodId: dellaTabla?.id ?? null,
      alimento: est.alimento,
      porcionG,
      porcionMl,
      kcal: Math.max(0, est.kcal),
      proteinaG: Math.max(0, est.proteina_g),
      carbsG: Math.max(0, est.carbs_g),
      grasaG: Math.max(0, est.grasa_g),
      nota: null,
    } satisfies ItemBorrador;
  });

  return { items, enlazados };
}
