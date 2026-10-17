/**
 * Lo que se contesta antes de tener cuenta.
 *
 * El flujo de entrada recoge las respuestas, calcula el plan y lo muestra
 * *antes* de pedir un correo: quien ve su número ya tiene algo que perder si
 * se va. Después, las respuestas viajan con el enlace de acceso y se aplican
 * al crear la cuenta (`lib/datos/aplicar-entrada`).
 *
 * Todo lo de acá es puro. Y todo lo que llega de fuera se valida con el
 * esquema: los metadatos del usuario los puede escribir cualquiera con su
 * propia sesión, así que se tratan como entrada no confiable.
 */
import { z } from "zod";
import { calcularPlan, tdee, tmb, type Plan } from "@/lib/nutrition";
import {
  METAS,
  parametrosDe,
  type Parametros,
} from "@/lib/nutrition/metas";
import { DIETAS, proteinaSegunFuerza } from "./dietas";

/** Debajo de esto no se arma un plan: la app no está pensada para menores. */
export const EDAD_MINIMA = 18;

/** Cuánto se mueve el rango alrededor del objetivo, a cada lado. */
const MARGEN_RANGO = 0.1;

/** Más allá de esto la proyección deja de ser una estimación útil. */
const SEMANAS_MAXIMAS = 104;

export const EntradaSchema = z.object({
  meta: z.enum(["bajar_grasa", "tonificar", "mantener", "ganar_musculo"]),
  actividad: z.enum(["sedentario", "poco", "moderado", "alto", "muy_alto"]),
  ritmo: z.enum(["suave", "normal", "rapido"]).optional(),
  sexo: z.enum(["hombre", "mujer"]),
  edad: z.number().int().min(EDAD_MINIMA).max(120),
  estaturaCm: z.number().min(100).max(250),
  pesoKg: z.number().min(20).max(400),
  pesoMetaKg: z.number().min(20).max(400).optional(),
  /** Sin esto se asume la recomendada: lo anterior a esta pregunta. */
  dieta: z.enum(["recomendada", "alta_proteina", "baja_carbs", "keto", "baja_grasa"]).optional(),
  /**
   * Cuántas veces a la semana entrena fuerza. Acepta también el sí/no de antes:
   * una respuesta vieja no puede romper la lectura.
   */
  fuerza: z.union([z.boolean(), z.enum(["ninguna", "1-2", "3-4", "5+"])]).optional(),
  /**
   * Lo que gasta al día según su reloj (promedio de calorías totales). Si está,
   * sustituye a la estimación por fórmula, que tiene un margen de ±10 %.
   */
  gastoMedidoKcal: z.number().min(1200).max(5000).optional(),
});

export type Entrada = z.infer<typeof EntradaSchema>;

/** Las respuestas que viajan en los metadatos, o null si no sirven. */
export function entradaDeMetadata(valor: unknown): Entrada | null {
  const analisis = EntradaSchema.safeParse(valor);
  return analisis.success ? analisis.data : null;
}

export interface PlanDeEntrada {
  parametros: Parametros;
  calculo: Plan;
  /** Hasta dónde se puede mover el día sin salirse del plan. */
  rango: { min: number; max: number };
  /** Si el gasto salió del reloj y no de la fórmula. */
  gastoUsado: boolean;
}

/** El rango en que un día "cuenta como bueno", redondeado a 10 kcal. */
export function rangoDeCalorias(kcal: number): { min: number; max: number } {
  const redondear = (n: number) => Math.round(n / 10) * 10;
  return {
    min: redondear(kcal * (1 - MARGEN_RANGO)),
    max: redondear(kcal * (1 + MARGEN_RANGO)),
  };
}

export function planDeEntrada(entrada: Entrada): PlanDeEntrada {
  const base = parametrosDe({
    meta: entrada.meta,
    actividad: entrada.actividad,
    ...(entrada.ritmo ? { ritmo: entrada.ritmo } : {}),
  });

  const persona = {
    sexo: entrada.sexo,
    edad: entrada.edad,
    estaturaCm: entrada.estaturaCm,
    pesoKg: entrada.pesoKg,
  };

  // Con el gasto de un reloj, el factor de actividad deja de ser una pregunta:
  // se despeja de la medida. Así todo lo que viene después (el perfil, el
  // ajuste semanal) reproduce el mismo gasto con la fórmula de siempre, sin
  // otro camino de cálculo. Si la medida da un factor imposible (menos que
  // estar quieto o más que un atleta), se ignora y se usa la fórmula.
  let parametros = base;
  let gastoUsado = false;
  const tmbKcal = tmb(persona);
  if (entrada.gastoMedidoKcal !== undefined) {
    const factor = Math.round((entrada.gastoMedidoKcal / tmbKcal) * 100) / 100;
    if (factor >= 1.0 && factor <= 2.5) {
      parametros = { ...base, factorActividad: factor };
      gastoUsado = true;
    }
  }

  // Primero la fuerza (cuánta proteína hace falta), después la dieta (de dónde
  // salen el resto de las calorías).
  const diales = {
    ...parametros.opciones,
    proteinaGPorKg: proteinaSegunFuerza(parametros.opciones.proteinaGPorKg, entrada.fuerza),
  };
  const opciones = DIETAS[entrada.dieta ?? "recomendada"].opciones(diales);

  const calculo = calcularPlan(
    persona,
    parametros.factorActividad,
    parametros.objetivo,
    parametros.deficitPct,
    opciones,
  );

  if (gastoUsado) {
    const formula = tdee(tmbKcal, base.factorActividad);
    calculo.avisos = [
      {
        nivel: "info",
        mensaje:
          `Usamos el gasto que midió tu reloj (${calculo.tdeeKcal.toLocaleString("es-CO")} kcal al día) ` +
          `en lugar de la estimación por fórmula (${formula.toLocaleString("es-CO")} kcal).`,
      },
      ...calculo.avisos,
    ];
  }

  return { parametros, calculo, rango: rangoDeCalorias(calculo.kcalObjetivo), gastoUsado };
}

/** Si la meta de peso va en la dirección que pide el objetivo. */
export function pesoMetaCoherente(
  meta: Entrada["meta"],
  pesoKg: number,
  pesoMetaKg: number,
): boolean {
  if (meta === "bajar_grasa" || meta === "tonificar") return pesoMetaKg < pesoKg;
  if (meta === "ganar_musculo") return pesoMetaKg > pesoKg;
  return false;
}

/** Las metas que preguntan por un peso objetivo. */
export function preguntaPesoMeta(meta: Entrada["meta"]): boolean {
  return meta !== "mantener";
}

/**
 * Semanas hasta el peso objetivo, con el ritmo medio esperado del plan.
 *
 * Es una estimación y se muestra como tal. Devuelve null cuando no hay una
 * respuesta honesta: la meta va al revés del plan, el ritmo es casi cero, o
 * tardaría más de dos años (a esa distancia el número no significa nada).
 */
export function semanasHastaMeta(
  pesoKg: number,
  pesoMetaKg: number,
  ritmo: { min: number; max: number },
): number | null {
  const delta = pesoMetaKg - pesoKg;
  const medio = (ritmo.min + ritmo.max) / 2;

  if (Math.abs(medio) < 0.05) return null;
  if (Math.sign(delta) !== Math.sign(medio)) return null;

  const semanas = Math.ceil(Math.abs(delta) / Math.abs(medio));
  return semanas > SEMANAS_MAXIMAS ? null : semanas;
}

/** ¿Esta meta usa la pregunta de ritmo? Reexporta la regla de la encuesta. */
export function preguntaRitmo(meta: Entrada["meta"]): boolean {
  return METAS[meta].preguntaRitmo;
}
