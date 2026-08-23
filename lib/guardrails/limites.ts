/**
 * Límites duros del registro con IA.
 *
 * Esta es la capa que de verdad pone el techo al gasto. La otra —pedirle al
 * modelo que no hable de otra cosa— también sirve, pero cuesta una llamada
 * cada vez que se activa; esta no cuesta ninguna.
 *
 * Módulo puro: decide a partir de contadores que le pasan. Quien los lee de
 * Postgres es `verificar.ts`. Separarlos permite probar cada rechazo sin base
 * y sin tocar la API.
 */

export const LIMITES = {
  /** Turnos por sesión de registro. Después: guardás o empezás de nuevo. */
  turnosPorSesion: 6,
  /** Caracteres por mensaje. Una corrección de comida no necesita más. */
  caracteresPorMensaje: 500,
  /** Fotos por sesión. Otra foto es otra comida, y por tanto otra sesión. */
  fotosPorSesion: 1,
  /** Sesiones por día. */
  sesionesPorDia: 20,
} as const;

export type MotivoRechazo =
  | "sin_contenido"
  | "mensaje_largo"
  | "demasiados_turnos"
  | "demasiadas_fotos"
  | "demasiadas_sesiones"
  | "tope_de_gasto";

export interface Rechazo {
  motivo: MotivoRechazo;
  /** Texto para mostrar. Dice qué pasó y qué se puede hacer igual. */
  mensaje: string;
}

/** Lo que hay que saber para decidir, sin importar de dónde salga. */
export interface EstadoCuota {
  /** Turnos ya gastados en esta sesión. */
  turnosDeLaSesion: number;
  /** Fotos ya subidas en esta sesión. */
  fotosDeLaSesion: number;
  /** Sesiones iniciadas hoy. */
  sesionesDeHoy: number;
  /** Gasto acumulado del mes, en dólares. */
  gastoDelMesUsd: number;
  /** Tope mensual configurado, en dólares. */
  topeMensualUsd: number;
}

export interface Entrada {
  texto: string | null;
  tieneFoto: boolean;
}

/**
 * Decide si la petición puede llegar a la API.
 *
 * Devuelve el primer motivo de rechazo, o null si puede seguir. El orden
 * importa: primero lo que es culpa de la petición (vacía, larga), después lo
 * que es culpa del uso acumulado, para que el mensaje sea el más accionable.
 */
export function verificarCuota(
  entrada: Entrada,
  estado: EstadoCuota,
): Rechazo | null {
  const texto = entrada.texto?.trim() ?? "";

  if (texto.length === 0 && !entrada.tieneFoto) {
    return {
      motivo: "sin_contenido",
      mensaje: "Mandá una foto, una descripción, o las dos.",
    };
  }

  if (texto.length > LIMITES.caracteresPorMensaje) {
    return {
      motivo: "mensaje_largo",
      mensaje:
        `El mensaje pasa de ${LIMITES.caracteresPorMensaje} caracteres. ` +
        `Describí solo la comida — el resto no ayuda a estimarla mejor.`,
    };
  }

  if (entrada.tieneFoto && estado.fotosDeLaSesion >= LIMITES.fotosPorSesion) {
    return {
      motivo: "demasiadas_fotos",
      mensaje:
        "Esta sesión ya tiene una foto. Si es otro plato, guardá esta comida " +
        "y empezá una nueva.",
    };
  }

  if (estado.turnosDeLaSesion >= LIMITES.turnosPorSesion) {
    return {
      motivo: "demasiados_turnos",
      mensaje:
        `Van ${LIMITES.turnosPorSesion} idas y vueltas en esta comida. ` +
        `Guardá lo que hay y ajustá los números a mano, que sale más rápido.`,
    };
  }

  if (estado.sesionesDeHoy >= LIMITES.sesionesPorDia) {
    return {
      motivo: "demasiadas_sesiones",
      mensaje:
        `Llegaste a ${LIMITES.sesionesPorDia} registros con IA hoy. ` +
        `El buscador y el registro manual siguen andando.`,
    };
  }

  if (estado.gastoDelMesUsd >= estado.topeMensualUsd) {
    return {
      motivo: "tope_de_gasto",
      mensaje:
        `Se alcanzó el tope de gasto del mes ` +
        `($${estado.topeMensualUsd.toFixed(2)}). El buscador y el registro ` +
        `manual siguen andando; el tope se cambia en la configuración.`,
    };
  }

  return null;
}
