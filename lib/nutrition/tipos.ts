/** Tipos del motor de nutrición. Módulo puro: nada de acá toca red ni base. */

export type Sexo = "hombre" | "mujer";

export type Objetivo = "perder_grasa" | "mantener" | "ganar_musculo";

export interface DatosPersona {
  sexo: Sexo;
  edad: number;
  estaturaCm: number;
  pesoKg: number;
}

export interface Macros {
  proteinaG: number;
  carbsG: number;
  grasaG: number;
}

export interface Plan extends Macros {
  tmbKcal: number;
  tdeeKcal: number;
  kcalObjetivo: number;
  deficitPct: number;
  /** Ritmo de cambio de peso esperado, en kg/semana. Negativo = perder. */
  ritmoEsperadoKgSemana: { min: number; max: number };
  avisos: Aviso[];
}

export interface Aviso {
  nivel: "info" | "atencion";
  mensaje: string;
}

export interface OpcionesPlan {
  /**
   * Gramos de proteína por kg de peso. 2.0 es lo que usa la bitácora y está
   * en el rango alto de 1.6–2.2 recomendado en déficit, donde el objetivo es
   * conservar músculo mientras baja la grasa.
   */
  proteinaGPorKg?: number;
  /**
   * Gramos de grasa por kg. 0.9 es lo que usa la bitácora.
   *
   * Ojo: con 1850 kcal eso deja la grasa en ~34 % de las calorías, por encima
   * de la banda 20–30 % del plan archivado. Es una desviación deliberada del
   * sistema real (encaja con cómo come: huevos, queso, chicharrón) y se
   * mantiene para que la app reproduzca los números con los que ya vive. El
   * mínimo fisiológico está muy por debajo, en 0.6 g/kg.
   */
  grasaGPorKg?: number;
}

export interface RegistroPeso {
  /** ISO 8601, AAAA-MM-DD. */
  fecha: string;
  pesoKg: number;
}

export interface PuntoTendencia {
  fecha: string;
  /** Media móvil de 7 días; null hasta que haya 7 días de datos. */
  mediaKg: number | null;
  pesoKg: number;
}

export type Sugerencia = "bajar" | "subir" | "mantener" | "sin_datos";

export interface AjusteSemanal {
  sugerencia: Sugerencia;
  /** Objetivo calórico propuesto. Igual al actual cuando es "mantener". */
  kcalPropuesto: number;
  kcalActual: number;
  /** Magnitud del ajuste, en porcentaje del objetivo actual. */
  pct: number;
  /** Ritmo real de las últimas dos semanas, kg/semana. Negativo = perdiendo. */
  ritmoReal: (number | null)[];
  razon: string;
}
