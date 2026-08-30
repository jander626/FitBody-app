/**
 * Cambiar la porción de un ítem.
 *
 * Vivía dentro del editor y por eso nadie la probaba. Tenía un error que se
 * veía de dos formas distintas y parecían dos bugs: al mover la porción de una
 * bebida escribía los gramos **sin borrar los mililitros**, así que el ítem
 * quedaba con las dos puestas. El validador lo rechazaba al guardar —"tiene
 * gramos y mililitros a la vez"— y, como la vista muestra los ml antes que los
 * gramos, el número en pantalla no cambiaba nunca: se sentía como un campo
 * trabado.
 */
import { macrosDePorcion, type Alimento } from "@/lib/alimentos";
import type { ItemBorrador } from "./tipos";

/** El alimento de la tabla, cuando el ítem quedó enlazado a uno. */
export type EnTabla = Pick<Alimento, "kcal100" | "p100" | "c100" | "g100">;

/**
 * @param enTabla El alimento enlazado, si lo hay. Solo se usa con gramos.
 */
export function recalcularPorcion<T extends ItemBorrador>(
  item: T,
  nueva: number,
  enTabla?: EnTabla,
): T {
  // Una porción es en gramos o en mililitros, nunca en las dos: la tabla tiene
  // una restricción que lo exige. Se escribe una y se borra la otra, siempre.
  const enMl = item.porcionMl !== null;
  const porcion = enMl
    ? { porcionG: null, porcionMl: nueva }
    : { porcionG: nueva, porcionMl: null };

  // La tabla sabe convertir gramos: sus valores son por 100 g. Aplicarlos a
  // mililitros daría por hecho que la densidad es 1 — cierto para un jugo,
  // falso para un aceite. Con ml se escala sobre lo estimado, que sale bien
  // sea cual sea la densidad. Es la misma regla que usa la normalización.
  if (enTabla && !enMl) {
    return { ...item, ...porcion, ...macrosDePorcion(enTabla, nueva) };
  }

  const anterior = enMl ? item.porcionMl : item.porcionG;

  // Sin porción previa no hay proporción que aplicar. Se anota la nueva y los
  // macros quedan como estaban: inventar una regla acá sería peor que no
  // tocarlos.
  if (anterior === null || anterior <= 0) {
    return { ...item, ...porcion };
  }

  // Sin redondear acá. Esto corre en cada tecla —escribir "300" pasa por 3 y
  // por 30—, y redondear a un decimal en cada paso hacía que el resultado
  // dependiera de cómo se tecleó: 250→300 ml daba 130 kcal en vez de 134.4,
  // porque el paso por 3 ml perdía precisión que no volvía. El redondeo va en
  // los bordes: la pantalla ya redondea al mostrar y la base guarda con dos
  // decimales.
  const factor = nueva / anterior;
  return {
    ...item,
    ...porcion,
    kcal: item.kcal * factor,
    proteinaG: item.proteinaG * factor,
    carbsG: item.carbsG * factor,
    grasaG: item.grasaG * factor,
  };
}
