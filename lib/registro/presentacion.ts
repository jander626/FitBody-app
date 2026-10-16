/**
 * Cómo se presenta una comida que se está armando: su título, el ícono de cada
 * ingrediente y de dónde vienen sus calorías.
 *
 * Todo sale de lo que ya hay en pantalla —nombres y macros—, sin pedirle nada a
 * nadie: por eso puede ser instantáneo y no gasta ninguna llamada de IA.
 *
 * Módulo puro.
 */
import { normalizar } from "@/lib/texto";
import type { ItemBorrador, Totales } from "./tipos";

/** El primero que coincida gana: va de lo más específico a lo más general. */
const EMOJIS: [RegExp, string][] = [
  [/\b(hamburguesa)\b/, "🍔"],
  [/\b(pizza)\b/, "🍕"],
  [/\b(perro|perrita|salchicha|salchipapa|chorizo)\b/, "🌭"],
  [/\b(empanada|pastel|carimanola|aborrajado|bunuelo|pandebono|almojabana)\b/, "🥟"],
  [/\b(arepa)\b/, "🫓"],
  [/\b(huevo|huevos|clara|pericos)\b/, "🥚"],
  [/\b(queso|cuajada|requeson|quesito)\b/, "🧀"],
  [/\b(tocineta|bacon|chicharron)\b/, "🥓"],
  [/\b(pollo|pechuga|muslo|alitas|nuggets|pavo)\b/, "🍗"],
  [/\b(res|carne|lomo|solomo|churrasco|sobrebarriga|costilla|cerdo|pernil|bondiola|morcilla|higado|lengua)\b/, "🥩"],
  [/\b(pescado|atun|salmon|trucha|mojarra|tilapia|sardinas|camarones|mariscos)\b/, "🐟"],
  [/\b(ajiaco|sancocho|sopa|caldo|mondongo|cuchuco|changua)\b/, "🍲"],
  [/\b(arroz)\b/, "🍚"],
  [/\b(pasta|espagueti|fideos)\b/, "🍝"],
  [/\b(frijoles|frijol|lentejas|garbanzos|arvejas)\b/, "🫘"],
  [/\b(papa|papas|yuca|name|arracacha)\b/, "🥔"],
  [/\b(platano|patacones|patacon|banano)\b/, "🍌"],
  [/\b(aguacate|guacamole)\b/, "🥑"],
  [/\b(pan|tostada|sandwich|tortilla|wrap)\b/, "🍞"],
  [/\b(cafe|tinto)\b/, "☕"],
  [/\b(leche|yogur|yogurt|kumis|kefir)\b/, "🥛"],
  [/\b(jugo|limonada|gaseosa|malta|agua|te)\b/, "🥤"],
  [/\b(cerveza|vino|aguardiente)\b/, "🍺"],
  [/\b(manzana|pera|naranja|mandarina|mora|fresa|uvas|mango|papaya|pina|sandia|melon|kiwi|guayaba|durazno|lulo|maracuya)\b/, "🍎"],
  [/\b(ensalada|lechuga|repollo|pepino|zanahoria|tomate|cebolla)\b/, "🥗"],
  [/\b(chocolate|chocolatina|helado|torta|ponque|galleta|bocadillo|arequipe|cocada|oblea|flan|natilla|dulce)\b/, "🍫"],
  [/\b(aceite|mantequilla|mayonesa|miel|panela)\b/, "🧈"],
  [/\b(nueces|almendras|mani|frutos)\b/, "🥜"],
];

/** Un ícono para el alimento, por su nombre. Genérico si no se reconoce. */
export function emojiDeAlimento(nombre: string): string {
  const n = normalizar(nombre);
  return EMOJIS.find(([patron]) => patron.test(n))?.[1] ?? "🍽️";
}

/** Sin lo que va entre paréntesis ("Pollo (a la plancha)" → "Pollo"). */
function sinParentesis(nombre: string): string {
  return nombre.replace(/\s*\([^)]*\)/g, "").trim();
}

/**
 * Un título para la comida: los dos primeros ingredientes y cuántos más.
 *
 * "Arepa de maiz y queso mozzarella", o "Arepa de maiz, queso mozzarella y 2
 * más". Corto a propósito: es un encabezado, no la lista.
 */
export function tituloDeComida(items: Pick<ItemBorrador, "alimento">[]): string {
  const nombres = items.map((i) => sinParentesis(i.alimento)).filter(Boolean);
  if (nombres.length === 0) return "Tu comida";

  const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${minuscula(nombres[1])}`;
  return `${nombres[0]}, ${minuscula(nombres[1])} y ${nombres.length - 2} más`;
}

/**
 * Qué parte de las calorías viene de cada macro, en porcentaje entero que suma
 * 100. Se reparte por el método del mayor resto: redondear cada uno por su
 * cuenta puede dar 99 o 101, y un reparto que no suma cien se nota.
 */
export function repartoDeEnergia(t: Totales): { proteina: number; carbs: number; grasa: number } {
  const kcal = [t.proteinaG * 4, t.carbsG * 4, t.grasaG * 9];
  const total = kcal.reduce((a, b) => a + b, 0);
  if (total <= 0) return { proteina: 0, carbs: 0, grasa: 0 };

  const exactos = kcal.map((k) => (k / total) * 100);
  const pisos = exactos.map(Math.floor);
  let faltan = 100 - pisos.reduce((a, b) => a + b, 0);

  const orden = exactos
    .map((e, i) => ({ i, resto: e - pisos[i] }))
    .sort((a, b) => b.resto - a.resto);
  for (const { i } of orden) {
    if (faltan <= 0) break;
    pisos[i]++;
    faltan--;
  }
  return { proteina: pisos[0], carbs: pisos[1], grasa: pisos[2] };
}
