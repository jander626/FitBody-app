/**
 * De lo que la gente quiere, a los números que necesita el motor.
 *
 * El formulario de Perfil pide un "factor de actividad" de 1.375 y un déficit
 * en porcentaje. Eso está bien si ya sabés qué son; si no, es una pared. Este
 * módulo traduce preguntas en castellano —qué querés lograr, cuánto te movés,
 * a qué ritmo— a esos mismos parámetros.
 *
 * No hay matemática nueva acá: el cálculo sigue siendo el de `motor.ts`, con
 * sus pisos y sus avisos. Esto es solo el diccionario.
 *
 * Módulo puro. Ni red ni base.
 */
import type { Objetivo, OpcionesPlan } from "./tipos";

// ------------------------------------------------------------------ metas ---

export type Meta = "bajar_grasa" | "tonificar" | "mantener" | "ganar_musculo";

export interface DefinicionMeta {
  id: Meta;
  titulo: string;
  /** Una línea, en las palabras de quien elige, no en jerga. */
  resumen: string;
  /** Qué va a pasar de verdad. Sin promesas. */
  expectativa: string;
  /** El objetivo que entiende el motor y que se guarda en la base. */
  objetivo: Objetivo;
  /** Déficit por defecto, en % del gasto. Negativo = superávit. */
  deficitPct: number;
  opciones: Required<OpcionesPlan>;
  /** Si tiene sentido preguntar por el ritmo. */
  preguntaRitmo: boolean;
}

/**
 * Las cuatro metas.
 *
 * "Tonificar" es la que más gente elige y la que peor se entiende. No es una
 * cuarta cosa: es perder grasa despacio con la proteína alta, entrenando.
 * Por eso comparte objetivo con bajar_grasa y solo cambia los diales — y la
 * app lo dice en pantalla en vez de dejar creer que hay una vía especial.
 *
 * Ese detalle también evita tener que tocar la base: la columna `objetivo`
 * solo acepta tres valores, y agregar un cuarto significaría una migración
 * para representar algo que nutricionalmente no es distinto.
 */
export const METAS: Record<Meta, DefinicionMeta> = {
  bajar_grasa: {
    id: "bajar_grasa",
    titulo: "Bajar de peso",
    resumen: "Perder grasa a un ritmo que se sostenga.",
    expectativa:
      "Vas a comer por debajo de lo que gastás. La balanza baja, y con proteína alta y entrenamiento lo que se pierde es sobre todo grasa.",
    objetivo: "perder_grasa",
    deficitPct: 20,
    opciones: { proteinaGPorKg: 2.0, grasaGPorKg: 0.9 },
    preguntaRitmo: true,
  },
  tonificar: {
    id: "tonificar",
    titulo: "Tonificar",
    resumen: "Bajar grasa despacio sin perder músculo.",
    expectativa:
      "Es bajar de peso, pero lento y con la proteína más alta. La balanza casi no se mueve; lo que cambia es cómo te queda la ropa. Pide paciencia: los cambios se ven en meses, no en semanas.",
    objetivo: "perder_grasa",
    deficitPct: 10,
    opciones: { proteinaGPorKg: 2.2, grasaGPorKg: 0.8 },
    preguntaRitmo: false,
  },
  mantener: {
    id: "mantener",
    titulo: "Mantener",
    resumen: "Quedarme donde estoy y comer mejor.",
    expectativa:
      "Vas a comer lo que gastás. El peso se queda cerca de donde está y el registro sirve para ver qué estás comiendo, no para cambiarlo.",
    objetivo: "mantener",
    deficitPct: 0,
    opciones: { proteinaGPorKg: 1.8, grasaGPorKg: 0.9 },
    preguntaRitmo: false,
  },
  ganar_musculo: {
    id: "ganar_musculo",
    titulo: "Ganar músculo",
    resumen: "Subir de peso entrenando fuerza.",
    expectativa:
      "Vas a comer por encima de lo que gastás. Parte de lo que subas va a ser grasa: no hay forma de ganar músculo sin algo de eso, y un superávit grande solo agrega más grasa, no más músculo.",
    objetivo: "ganar_musculo",
    deficitPct: -12,
    opciones: { proteinaGPorKg: 2.0, grasaGPorKg: 0.9 },
    preguntaRitmo: false,
  },
};

export const ORDEN_METAS: Meta[] = [
  "bajar_grasa",
  "tonificar",
  "mantener",
  "ganar_musculo",
];

// ------------------------------------------------------------- actividad ---

export type NivelActividad = "sedentario" | "poco" | "moderado" | "alto" | "muy_alto";

export interface DefinicionActividad {
  id: NivelActividad;
  titulo: string;
  /** Descrito por lo que hacés en una semana, no por un número. */
  detalle: string;
  factor: number;
}

/**
 * Los cinco niveles.
 *
 * Descritos por semana y en actividades concretas, porque "moderadamente
 * activo" no significa lo mismo para dos personas y "1.55" no significa nada
 * para casi nadie.
 *
 * Ante la duda conviene elegir el de abajo: sobrestimar el gasto infla el
 * objetivo de calorías y hace que el plan no funcione sin que se entienda por
 * qué. Es el error más común y el más caro.
 */
export const ACTIVIDADES: Record<NivelActividad, DefinicionActividad> = {
  sedentario: {
    id: "sedentario",
    titulo: "Casi nada",
    detalle: "Trabajo sentado y no entreno.",
    factor: 1.2,
  },
  poco: {
    id: "poco",
    titulo: "Poco",
    detalle: "Camino algo y entreno una o dos veces por semana.",
    factor: 1.375,
  },
  moderado: {
    id: "moderado",
    titulo: "Moderado",
    detalle: "Entreno tres o cuatro veces por semana.",
    factor: 1.55,
  },
  alto: {
    id: "alto",
    titulo: "Bastante",
    detalle: "Entreno cinco o seis veces por semana.",
    factor: 1.725,
  },
  muy_alto: {
    id: "muy_alto",
    titulo: "Mucho",
    detalle: "Entreno a diario, o mi trabajo es físico.",
    factor: 1.9,
  },
};

export const ORDEN_ACTIVIDADES: NivelActividad[] = [
  "sedentario",
  "poco",
  "moderado",
  "alto",
  "muy_alto",
];

// ----------------------------------------------------------------- ritmo ---

export type Ritmo = "suave" | "normal" | "rapido";

export interface DefinicionRitmo {
  id: Ritmo;
  titulo: string;
  detalle: string;
  deficitPct: number;
}

/**
 * A qué velocidad bajar.
 *
 * Solo se pregunta cuando la meta es bajar de peso: en mantener no aplica, y
 * en ganar músculo un superávit más grande no construye músculo más rápido,
 * solo agrega grasa.
 *
 * El rápido llega hasta 25 % y no más. Por encima de eso se pierde músculo
 * junto con la grasa y el hambre vuelve el plan insostenible — y el piso
 * calórico del motor lo frena igual, así que ofrecerlo sería ofrecer algo que
 * la app después no va a dar.
 */
export const RITMOS: Record<Ritmo, DefinicionRitmo> = {
  suave: {
    id: "suave",
    titulo: "Suave",
    detalle: "Menos hambre, resultados más lentos.",
    deficitPct: 12,
  },
  normal: {
    id: "normal",
    titulo: "Normal",
    detalle: "El punto medio, y el que casi todos sostienen.",
    deficitPct: 20,
  },
  rapido: {
    id: "rapido",
    titulo: "Rápido",
    detalle: "Más rápido, pero cuesta más sostenerlo.",
    deficitPct: 25,
  },
};

export const ORDEN_RITMOS: Ritmo[] = ["suave", "normal", "rapido"];

// -------------------------------------------------------------- traducir ---

export interface Respuestas {
  meta: Meta;
  actividad: NivelActividad;
  /** Solo cuando la meta lo pide; si no, se ignora. */
  ritmo?: Ritmo;
}

export interface Parametros {
  objetivo: Objetivo;
  factorActividad: number;
  deficitPct: number;
  opciones: Required<OpcionesPlan>;
}

// ------------------------------------------------------------ de vuelta ---

/**
 * El camino inverso: de un número guardado a las palabras que lo produjeron.
 *
 * Hace falta para mostrar en Perfil qué significa el factor sin volver a
 * pedirlo. Devuelve null cuando el valor no salió de la encuesta —un objetivo
 * importado de la bitácora, o un número puesto a mano antes de que la encuesta
 * existiera—, y ahí la pantalla muestra el número crudo en vez de mentir con
 * una etiqueta que no le corresponde.
 */
export function actividadDeFactor(factor: number): DefinicionActividad | null {
  return (
    Object.values(ACTIVIDADES).find(
      // Con tolerancia: numeric(4,2) devuelve 1.375 como 1.38 y una
      // comparación exacta no encontraría nada.
      (nivel) => Math.abs(nivel.factor - factor) < 0.01,
    ) ?? null
  );
}

/** Lo mismo para el ritmo, entre las metas que lo preguntan. */
export function ritmoDeDeficit(deficitPct: number): DefinicionRitmo | null {
  return Object.values(RITMOS).find((r) => r.deficitPct === deficitPct) ?? null;
}

/** Cómo llamar a un objetivo guardado, en las palabras de la encuesta. */
export function metaDeObjetivo(
  objetivo: Objetivo,
  deficitPct: number,
): DefinicionMeta {
  // perder_grasa cubre dos metas: la distingue el déficit, que es justamente
  // lo único en que se diferencian.
  if (objetivo === "perder_grasa") {
    return deficitPct <= METAS.tonificar.deficitPct ? METAS.tonificar : METAS.bajar_grasa;
  }
  return objetivo === "mantener" ? METAS.mantener : METAS.ganar_musculo;
}

/** Las respuestas, convertidas en lo que el motor sabe usar. */
export function parametrosDe(respuestas: Respuestas): Parametros {
  const meta = METAS[respuestas.meta];
  const usaRitmo = meta.preguntaRitmo && respuestas.ritmo !== undefined;

  return {
    objetivo: meta.objetivo,
    factorActividad: ACTIVIDADES[respuestas.actividad].factor,
    // El ritmo solo pisa el déficit donde tiene sentido preguntarlo. Si
    // llegara un ritmo en una meta que no lo usa, se ignora en vez de
    // convertir "mantener" en un déficit del 20 % sin que nadie lo pidiera.
    deficitPct: usaRitmo ? RITMOS[respuestas.ritmo!].deficitPct : meta.deficitPct,
    opciones: meta.opciones,
  };
}
