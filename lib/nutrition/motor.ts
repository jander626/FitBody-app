/**
 * El corazón matemático: TMB, gasto total, objetivo calórico y macros.
 *
 * Módulo puro y sin dependencias. Se verifica contra los números reales de la
 * bitácora (fitfood/data/perfil.json), que son la respuesta conocida: si esto
 * no reproduce 1676 / 2450 / 1850 / 160-145-70, está mal.
 */
import type {
  Aviso,
  DatosPersona,
  Macros,
  Objetivo,
  OpcionesPlan,
  Plan,
  Sexo,
} from "./tipos";

/** Calorías por gramo de cada macronutriente. */
export const KCAL_POR_G = { proteina: 4, carbs: 4, grasa: 9 } as const;

/**
 * Piso calórico por debajo del cual la app no propone un objetivo.
 * No es una opinión: por debajo de esto es muy difícil cubrir micronutrientes
 * sin supervisión profesional.
 */
export const PISO_KCAL: Record<Sexo, number> = { hombre: 1500, mujer: 1200 };

/** Mínimo fisiológico de grasa, en g/kg. Por debajo se resiente lo hormonal. */
export const GRASA_MINIMA_G_POR_KG = 0.6;

const DEFECTOS: Required<OpcionesPlan> = {
  proteinaGPorKg: 2.0,
  grasaGPorKg: 0.9,
};

/** Déficit/superávit por defecto según el objetivo, en % del gasto total. */
export const AJUSTE_POR_OBJETIVO: Record<Objetivo, number> = {
  perder_grasa: 20,
  mantener: 0,
  ganar_musculo: -12,
};

/** Redondea al múltiplo de `paso` más cercano. */
export function redondearA(valor: number, paso: number): number {
  return Math.round(valor / paso) * paso;
}

/**
 * Tasa metabólica basal — Mifflin-St Jeor.
 *
 * Devuelve el valor sin redondear. La bitácora muestra 1676 porque trunca
 * 1676.5; redondear acá arrastraría el error a todo lo que viene después.
 */
export function tmb({ sexo, edad, estaturaCm, pesoKg }: DatosPersona): number {
  const base = 10 * pesoKg + 6.25 * estaturaCm - 5 * edad;
  return sexo === "hombre" ? base + 5 : base - 161;
}

/**
 * Gasto energético total.
 *
 * Se redondea a la decena: el factor de actividad es una estimación con un
 * margen de ±10 %, y presentar 2447.69 sugiere una precisión que no existe.
 */
export function tdee(tmbKcal: number, factorActividad: number): number {
  return redondearA(tmbKcal * factorActividad, 10);
}

/**
 * Objetivo calórico diario, redondeado a la cincuentena por la misma razón
 * que el gasto: es un blanco al que apuntar, no una cifra exacta.
 */
export function kcalObjetivo(tdeeKcal: number, deficitPct: number): number {
  return redondearA(tdeeKcal * (1 - deficitPct / 100), 50);
}

/**
 * Reparto de macros.
 *
 * La proteína y la grasa se fijan por peso corporal (no por porcentaje de
 * calorías) porque es lo que el cuerpo necesita en términos absolutos; los
 * carbohidratos se llevan lo que sobre. Ese orden importa: en un déficit, lo
 * que no se puede recortar es la proteína.
 */
export function macros(
  pesoKg: number,
  kcal: number,
  opciones: OpcionesPlan = {},
): Macros {
  const { proteinaGPorKg, grasaGPorKg } = { ...DEFECTOS, ...opciones };

  const proteinaG = redondearA(pesoKg * proteinaGPorKg, 5);
  const grasaG = redondearA(pesoKg * grasaGPorKg, 5);

  const kcalRestantes =
    kcal - proteinaG * KCAL_POR_G.proteina - grasaG * KCAL_POR_G.grasa;
  const carbsG = Math.max(0, Math.round(kcalRestantes / KCAL_POR_G.carbs));

  return { proteinaG, carbsG, grasaG };
}

/** Índice de masa corporal. */
export function imc(pesoKg: number, estaturaCm: number): number {
  const m = estaturaCm / 100;
  return pesoKg / (m * m);
}

/** Equivalencia energética de un kilo de grasa corporal. */
export const KCAL_POR_KG_GRASA = 7700;

/**
 * Ritmo de cambio de peso esperado, en kg/semana.
 *
 * Convención de signos: es un *cambio de peso*, así que perder es negativo y
 * ganar es positivo. Se devuelve el intervalo ordenado de menor a mayor, sin
 * excepciones, para que comparar contra él no dependa de la dirección.
 *
 * Se deriva del déficit y de la equivalencia ~7700 kcal por kg de grasa, y se
 * acota a ~1 % del peso corporal por semana: pasado eso, lo que se pierde de
 * más sale del músculo.
 */
export function ritmoEsperado(
  pesoKg: number,
  tdeeKcal: number,
  kcal: number,
): { min: number; max: number } {
  const deficitDiario = tdeeKcal - kcal;
  // Negativo cuando hay déficit (se pierde peso), positivo en superávit.
  const teorico = (-deficitDiario * 7) / KCAL_POR_KG_GRASA;

  // En la práctica se logra entre el 80 % y el 105 % del ritmo teórico: la
  // adherencia no es perfecta y el gasto baja un poco al bajar el peso.
  const techo = pesoKg * 0.01;
  const acotar = (v: number) =>
    Math.round(Math.sign(v) * Math.min(Math.abs(v), techo) * 100) / 100;

  const extremos = [acotar(teorico * 0.8), acotar(teorico * 1.05)];
  return { min: Math.min(...extremos), max: Math.max(...extremos) };
}

/**
 * Calcula el plan completo y reúne los avisos.
 *
 * Nunca lanza: si los datos llevan a un objetivo inseguro, lo sube al piso y
 * lo dice en un aviso. Una app de salud que se rompe en silencio es peor que
 * una que discute.
 */
export function calcularPlan(
  persona: DatosPersona,
  factorActividad: number,
  objetivo: Objetivo = "perder_grasa",
  deficitPct: number = AJUSTE_POR_OBJETIVO[objetivo],
  opciones: OpcionesPlan = {},
): Plan {
  const avisos: Aviso[] = [];

  const tmbKcal = tmb(persona);
  const tdeeKcal = tdee(tmbKcal, factorActividad);

  let kcal = kcalObjetivo(tdeeKcal, deficitPct);

  const piso = PISO_KCAL[persona.sexo];
  if (kcal < piso) {
    avisos.push({
      nivel: "atencion",
      mensaje:
        `El déficit pedido deja el objetivo en ${kcal} kcal, por debajo del ` +
        `piso de ${piso} kcal. Se ajustó a ${piso}. Un déficit más agresivo ` +
        `que este no acelera la pérdida de grasa: acelera la de músculo.`,
    });
    kcal = piso;
  }

  const reparto = macros(persona.pesoKg, kcal, opciones);

  const grasaMinima = persona.pesoKg * GRASA_MINIMA_G_POR_KG;
  if (reparto.grasaG < grasaMinima) {
    avisos.push({
      nivel: "atencion",
      mensaje:
        `La grasa quedó en ${reparto.grasaG} g, por debajo del mínimo ` +
        `fisiológico de ${Math.round(grasaMinima)} g.`,
    });
  }

  if (reparto.carbsG === 0) {
    avisos.push({
      nivel: "atencion",
      mensaje:
        "La proteína y la grasa ya consumen todo el objetivo calórico: no " +
        "queda espacio para carbohidratos. Revisa el déficit o los gramos por kg.",
    });
  }

  const indice = imc(persona.pesoKg, persona.estaturaCm);
  if (indice < 18.5) {
    avisos.push({
      nivel: "atencion",
      mensaje:
        `Con un IMC de ${indice.toFixed(1)} un déficit no es lo indicado. ` +
        "Vale la pena consultar con un profesional antes de seguir.",
    });
  } else if (indice >= 35) {
    avisos.push({
      nivel: "info",
      mensaje:
        `Con un IMC de ${indice.toFixed(1)}, un acompañamiento profesional ` +
        "hace una diferencia real en el resultado.",
    });
  }

  return {
    tmbKcal,
    tdeeKcal,
    kcalObjetivo: kcal,
    deficitPct,
    ...reparto,
    ritmoEsperadoKgSemana: ritmoEsperado(persona.pesoKg, tdeeKcal, kcal),
    avisos,
  };
}
