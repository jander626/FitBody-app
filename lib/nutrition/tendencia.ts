/**
 * Tendencia de peso y ajuste adaptativo del objetivo calórico.
 *
 * El peso diario es ruido: agua, sal, glucógeno y a qué hora fue el baño mueven
 * ±1 kg sin que cambie un gramo de grasa. Por eso nada de acá mira un día
 * suelto — todo pasa por la media móvil de 7 días.
 *
 * Este es el mecanismo que corrige el error acumulado de las estimaciones por
 * foto: da igual que cada comida traiga un ±15 % si la tendencia de peso, que
 * es un dato objetivo, reajusta el objetivo cada semana.
 */
import { PISO_KCAL, redondearA } from "./motor";
import type {
  AjusteSemanal,
  PuntoTendencia,
  RegistroPeso,
  Sexo,
} from "./tipos";

/** Días que necesita la media móvil antes de decir algo. */
export const VENTANA_DIAS = 7;

/** Días de historia que exige el ajuste: dos semanas comparables. */
export const DIAS_MINIMOS_AJUSTE = VENTANA_DIAS * 2 + 1;

function aFecha(iso: string): number {
  // Se fuerza UTC para que el cálculo de días no dependa de la zona horaria
  // ni del horario de verano.
  return Date.parse(`${iso}T00:00:00Z`);
}

const DIA_MS = 86_400_000;

/**
 * Serie con media móvil de 7 días.
 *
 * La media se calcula sobre los días *calendario* previos, no sobre los
 * últimos 7 registros: si te pesas de lunes a viernes y te saltas el fin de
 * semana, promediar "los últimos 7 registros" mezclaría casi dos semanas y
 * suavizaría de más.
 */
export function mediaMovil7d(registros: RegistroPeso[]): PuntoTendencia[] {
  const ordenados = [...registros].sort((a, b) => aFecha(a.fecha) - aFecha(b.fecha));

  return ordenados.map((registro, i) => {
    const hasta = aFecha(registro.fecha);
    const desde = hasta - (VENTANA_DIAS - 1) * DIA_MS;

    const ventana: number[] = [];
    for (let j = i; j >= 0; j--) {
      const t = aFecha(ordenados[j].fecha);
      if (t < desde) break;
      ventana.push(ordenados[j].pesoKg);
    }

    // Sin al menos 4 pesajes en la ventana la media es tan ruidosa como el
    // dato crudo, y presentarla como "tendencia" sería engañoso.
    const media =
      ventana.length >= 4
        ? Math.round((ventana.reduce((a, b) => a + b, 0) / ventana.length) * 100) / 100
        : null;

    return { fecha: registro.fecha, pesoKg: registro.pesoKg, mediaKg: media };
  });
}

/** Media móvil en la fecha dada, o la más reciente anterior. null si no hay. */
function mediaEn(serie: PuntoTendencia[], objetivoMs: number): number | null {
  let encontrada: number | null = null;
  for (const punto of serie) {
    if (aFecha(punto.fecha) > objetivoMs) break;
    if (punto.mediaKg !== null) encontrada = punto.mediaKg;
  }
  return encontrada;
}

/**
 * Ritmo real de cambio, en kg/semana, mirando `semanasAtras` semanas atrás.
 * Negativo = perdiendo peso.
 */
export function ritmoSemanal(
  serie: PuntoTendencia[],
  semanasAtras = 0,
): number | null {
  if (serie.length === 0) return null;

  const ultima = aFecha(serie[serie.length - 1].fecha);
  const fin = ultima - semanasAtras * VENTANA_DIAS * DIA_MS;
  const inicio = fin - VENTANA_DIAS * DIA_MS;

  const mediaFin = mediaEn(serie, fin);
  const mediaInicio = mediaEn(serie, inicio);
  if (mediaFin === null || mediaInicio === null) return null;

  return Math.round((mediaFin - mediaInicio) * 100) / 100;
}

/**
 * Sugiere un ajuste del objetivo calórico comparando el ritmo real con el
 * esperado.
 *
 * Deliberadamente conservador. Solo propone algo cuando **dos semanas
 * seguidas** van fuera de rango, porque una sola semana rara vez es señal:
 * un fin de semana salado o una digestión lenta explican medio kilo. Y nunca
 * aplica el cambio — devuelve una sugerencia que la persona acepta.
 */
export function ajusteSemanal(
  registros: RegistroPeso[],
  kcalActual: number,
  ritmoEsperadoKgSemana: { min: number; max: number },
  sexo: Sexo,
): AjusteSemanal {
  const serie = mediaMovil7d(registros);
  const ritmoReal = [ritmoSemanal(serie, 0), ritmoSemanal(serie, 1)];

  const base: AjusteSemanal = {
    sugerencia: "sin_datos",
    kcalPropuesto: kcalActual,
    kcalActual,
    pct: 0,
    ritmoReal,
    razon: "",
  };

  const diasDistintos = new Set(registros.map((r) => r.fecha)).size;
  if (diasDistintos < DIAS_MINIMOS_AJUSTE || ritmoReal.some((r) => r === null)) {
    return {
      ...base,
      razon:
        `Hacen falta al menos ${DIAS_MINIMOS_AJUSTE} días de pesaje para ` +
        `comparar dos semanas. Van ${diasDistintos}.`,
    };
  }

  const [estaSemana, semanaPasada] = ritmoReal as [number, number];
  const { min, max } = ritmoEsperadoKgSemana;

  const lento = (r: number) => r > max; // cambió menos de lo esperado
  const rapido = (r: number) => r < min; // cambió más de lo esperado

  const promedio = (estaSemana + semanaPasada) / 2;
  const formato = (r: number) => `${r > 0 ? "+" : ""}${r.toFixed(2)} kg`;
  const detalle = `Últimas dos semanas: ${formato(estaSemana)} y ${formato(
    semanaPasada,
  )} por semana; lo esperado era entre ${min.toFixed(2)} y ${max.toFixed(2)} kg.`;

  if (lento(estaSemana) && lento(semanaPasada)) {
    // Qué tan lejos quedó: si apenas se rozó el rango, 5 %; si el peso ni se
    // movió (o subió), 10 %.
    const desviacion = Math.abs(promedio - max);
    const pct = desviacion > Math.abs(max) * 0.5 ? 10 : 5;
    const propuesto = Math.max(
      PISO_KCAL[sexo],
      redondearA(kcalActual * (1 - pct / 100), 50),
    );

    if (propuesto >= kcalActual) {
      return {
        ...base,
        sugerencia: "mantener",
        razon:
          `${detalle} Correspondería bajar calorías, pero ya estás en el piso ` +
          `de ${PISO_KCAL[sexo]} kcal. El ajuste toca hacerlo por el otro lado: ` +
          `más actividad o más sueño, no menos comida.`,
      };
    }

    return {
      ...base,
      sugerencia: "bajar",
      kcalPropuesto: propuesto,
      pct,
      razon: `${detalle} Sugerido: bajar ${pct} % a ${propuesto} kcal.`,
    };
  }

  if (rapido(estaSemana) && rapido(semanaPasada)) {
    const desviacion = Math.abs(promedio - min);
    const pct = desviacion > Math.abs(min) * 0.5 ? 10 : 5;
    const propuesto = redondearA(kcalActual * (1 + pct / 100), 50);
    return {
      ...base,
      sugerencia: "subir",
      kcalPropuesto: propuesto,
      pct,
      razon:
        `${detalle} Estás bajando más rápido de lo sostenible, y eso se paga ` +
        `con músculo. Sugerido: subir ${pct} % a ${propuesto} kcal.`,
    };
  }

  return {
    ...base,
    sugerencia: "mantener",
    razon: `${detalle} Vas en rango: no hay nada que tocar.`,
  };
}
