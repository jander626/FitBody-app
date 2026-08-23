/**
 * La tabla de alimentos: búsqueda y cálculo de porciones.
 *
 * Acá vive la regla central del sistema: **la tabla pone los números.** Un
 * alimento con valores por 100 g nunca se estima — se multiplica. La IA (y la
 * persona) deciden qué se comió y cuánto; los macros salen de acá.
 *
 * Módulo puro, sin I/O: lo usan el buscador en el navegador y la
 * normalización en el servidor.
 */
import { normalizar } from "./texto";

export interface Alimento {
  id: string;
  slug: string;
  nombre: string;
  categoria: string;
  kcal100: number;
  p100: number;
  c100: number;
  g100: number;
  porcionG: number | null;
  porcionNota: string | null;
}

export interface MacrosCalculados {
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
}

/** Redondea a un decimal: más precisión que eso es ruido en una estimación. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Macros de una porción, calculados desde los valores por 100 g. */
export function macrosDePorcion(
  alimento: Pick<Alimento, "kcal100" | "p100" | "c100" | "g100">,
  gramos: number,
): MacrosCalculados {
  const factor = gramos / 100;
  return {
    kcal: r1(alimento.kcal100 * factor),
    proteinaG: r1(alimento.p100 * factor),
    carbsG: r1(alimento.c100 * factor),
    grasaG: r1(alimento.g100 * factor),
  };
}

/**
 * Busca en la tabla.
 *
 * Se filtra en memoria a propósito: son ~133 alimentos, así que se traen una
 * vez y el buscador responde sin ida y vuelta por cada tecla.
 *
 * Cada palabra de la consulta tiene que aparecer en algún lado, en cualquier
 * orden: "pollo pechuga" encuentra "Pechuga de pollo sin piel". Los que
 * empiezan con la consulta van primero, que es lo que uno espera al escribir.
 */
export function buscarAlimentos(
  alimentos: Alimento[],
  consulta: string,
  limite = 30,
): Alimento[] {
  const q = normalizar(consulta);
  if (q.length === 0) return alimentos.slice(0, limite);

  const palabras = q.split(" ").filter(Boolean);

  const coincidencias = alimentos
    .map((alimento) => {
      const nombre = normalizar(alimento.nombre);
      const categoria = normalizar(alimento.categoria);
      const heno = `${nombre} ${categoria}`;

      if (!palabras.every((p) => heno.includes(p))) return null;

      // Menor puntaje = más arriba.
      let puntaje = 2;
      if (nombre.startsWith(q)) puntaje = 0;
      else if (nombre.includes(q)) puntaje = 1;

      return { alimento, puntaje, largo: nombre.length };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return coincidencias
    .sort(
      (a, b) =>
        a.puntaje - b.puntaje ||
        // A igual relevancia, el nombre más corto suele ser el más genérico,
        // que es el que se busca cuando uno escribe poco.
        a.largo - b.largo ||
        a.alimento.nombre.localeCompare(b.alimento.nombre),
    )
    .slice(0, limite)
    .map((m) => m.alimento);
}

/** Porción por defecto al agregar un alimento: la típica, o 100 g. */
export function porcionSugerida(alimento: Alimento): number {
  return alimento.porcionG ?? 100;
}
