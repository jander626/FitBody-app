/**
 * Clasificación de un día según sus calorías.
 *
 * Los tres estados no son "bien / regular / mal": son tres cosas distintas
 * que le pasan al déficit, que es lo que mueve el peso.
 *
 *  - `objetivo`  comiste dentro del objetivo. El día salió como estaba planeado.
 *  - `deficit`   te pasaste del objetivo pero seguiste por debajo del gasto.
 *                Sigue siendo un día que resta: menos de lo planeado, pero resta.
 *  - `sin_deficit` comiste por encima del gasto estimado. Ese día no hubo déficit.
 *
 * Se codifican con dos colores y la forma (relleno o contorno), no con tres
 * colores: en modo oscuro tres tonos cálidos no se distinguen entre sí, y el
 * color solo nunca debería ser el único canal.
 */

export type EstadoDia = "objetivo" | "deficit" | "sin_deficit" | "sin_registro";

export interface DiaHistorial {
  fecha: string;
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
  comidas: number;
}

export interface ResumenDia extends DiaHistorial {
  estado: EstadoDia;
  /** Porcentaje del objetivo de proteína cumplido. */
  pctProteina: number;
  /** Déficit real de ese día: gasto − consumido. Negativo si se pasó. */
  deficit: number;
  /** El gasto con el que se calculó el déficit de este día. */
  gastoKcal: number;
  /**
   * Si ese gasto lo midió el reloj o salió de la fórmula.
   *
   * Importa distinguirlo: el estimado es el mismo número todos los días y no
   * sabe si caminaste 4.000 pasos o 16.000. Un déficit calculado contra un
   * gasto inventado se parece a un dato y no lo es.
   */
  gastoMedido: boolean;
}

/** Un 5 % de margen: pasarse por 40 kcal no cambia el día. */
export const MARGEN = 1.05;

export function clasificarDia(
  kcal: number,
  objetivoKcal: number,
  gastoKcal: number,
): EstadoDia {
  if (kcal <= objetivoKcal * MARGEN) return "objetivo";
  if (kcal < gastoKcal) return "deficit";
  return "sin_deficit";
}

/**
 * @param gastoKcal    El estimado por fórmula, para los días sin medición.
 * @param gastoMedido  Gasto real del reloj por fecha, cuando se importó.
 */
export function resumir(
  dias: DiaHistorial[],
  objetivo: { kcal: number; proteinaG: number },
  gastoKcal: number,
  gastoMedido?: ReadonlyMap<string, number>,
): ResumenDia[] {
  return dias.map((d) => {
    const medido = gastoMedido?.get(d.fecha);
    const gasto = medido ?? gastoKcal;
    return {
      ...d,
      estado: clasificarDia(d.kcal, objetivo.kcal, gasto),
      pctProteina:
        objetivo.proteinaG > 0
          ? Math.round((d.proteinaG / objetivo.proteinaG) * 100)
          : 0,
      deficit: Math.round(gasto - d.kcal),
      gastoKcal: gasto,
      gastoMedido: medido !== undefined,
    };
  });
}

/** Promedios del periodo. Null cuando no hay días con registro. */
export function promedios(dias: ResumenDia[]) {
  if (dias.length === 0) return null;
  const suma = dias.reduce(
    (a, d) => ({
      kcal: a.kcal + d.kcal,
      proteinaG: a.proteinaG + d.proteinaG,
      carbsG: a.carbsG + d.carbsG,
      grasaG: a.grasaG + d.grasaG,
      deficit: a.deficit + d.deficit,
    }),
    { kcal: 0, proteinaG: 0, carbsG: 0, grasaG: 0, deficit: 0 },
  );
  const n = dias.length;
  return {
    dias: n,
    kcal: Math.round(suma.kcal / n),
    proteinaG: Math.round(suma.proteinaG / n),
    carbsG: Math.round(suma.carbsG / n),
    grasaG: Math.round(suma.grasaG / n),
    deficit: Math.round(suma.deficit / n),
    /** Días en los que se cumplió el objetivo calórico. */
    enObjetivo: dias.filter((d) => d.estado === "objetivo").length,
  };
}

const DIA_MS = 86_400_000;

/** Días de un mes, alineados a semanas que empiezan en lunes. */
export function cuadriculaMes(anio: number, mes: number): (string | null)[] {
  const primero = new Date(Date.UTC(anio, mes, 1));
  // getUTCDay() da 0 para domingo; acá la semana arranca en lunes.
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

  const celdas: (string | null)[] = Array(desplazamiento).fill(null);
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(
      new Date(Date.UTC(anio, mes, d)).toISOString().slice(0, 10),
    );
  }
  // Se completa la última semana para que la cuadrícula no quede dentada.
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

export function sumarMeses(anio: number, mes: number, delta: number) {
  const d = new Date(Date.UTC(anio, mes + delta, 1));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
}

export function hoyMenos(dias: number): string {
  return new Date(Date.now() - dias * DIA_MS).toISOString().slice(0, 10);
}
