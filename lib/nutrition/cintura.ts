/**
 * Qué dice la cintura que la balanza no dice.
 *
 * El peso solo no distingue entre perder grasa y perder músculo, y esa es la
 * diferencia que importa. La cinta métrica sí: la grasa abdominal es lo primero
 * que se va con un déficit y lo primero que vuelve sin él, y no la mueven ni el
 * agua ni el glucógeno, que son los que hacen ruido en la balanza.
 *
 * Cruzar las dos series da la lectura que ninguna da sola. El caso que más vale
 * es "el peso no baja pero la cintura sí": eso es recomposición, va bien, y sin
 * la cinta uno lo lee como estancamiento y recorta calorías sin necesidad.
 *
 * Módulo puro. Los umbrales son conservadores a propósito: una cinta métrica
 * mal puesta se equivoca por más de un centímetro, y decir de más con datos
 * ruidosos es peor que callarse.
 */
import type { PuntoTendencia } from "./tipos";

export interface MedidaCintura {
  fecha: string;
  cinturaCm: number;
}

/**
 * Por debajo de esto no se dice nada de la cintura.
 *
 * No es la precisión de la cinta —que marca milímetros— sino la de volver a
 * ponerla en el mismo sitio una semana después. Medio centímetro arriba o abajo
 * del ombligo ya cambia la lectura.
 */
export const RUIDO_CINTURA_CM = 1;

/** Por debajo de esto, el cambio de la tendencia de peso todavía es agua. */
export const RUIDO_PESO_KG = 0.5;

/** Antes de esto no hay con qué comparar: la grasa no se mueve en tres días. */
export const DIAS_MINIMOS = 14;

/** Cuánto atrás se busca la medida con la que comparar. */
export const VENTANA_COMPARACION_DIAS = 28;

export type Lectura =
  | "sin_medidas"
  | "primera"
  | "muy_pronto"
  | "grasa_bajando"
  | "recomposicion"
  | "peso_sin_cintura"
  | "magra_subiendo"
  | "grasa_subiendo"
  | "estable"
  | "discordante";

export interface LecturaComposicion {
  lectura: Lectura;
  titulo: string;
  detalle: string;
  /** Negativo = bajó. Null cuando no hay con qué comparar. */
  deltaCinturaCm: number | null;
  /** De la media móvil, no del peso de un día. Null si no alcanza. */
  deltaPesoKg: number | null;
  dias: number | null;
}

function aFecha(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

const DIA_MS = 86_400_000;

/** La media móvil vigente en una fecha: la última que exista hasta ese día. */
function tendenciaEn(serie: PuntoTendencia[], fecha: string): number | null {
  const limite = aFecha(fecha);
  let valor: number | null = null;
  for (const punto of serie) {
    if (aFecha(punto.fecha) > limite) break;
    if (punto.mediaKg !== null) valor = punto.mediaKg;
  }
  return valor;
}

/**
 * @param medidas  Medidas de cintura, en cualquier orden.
 * @param serie    Peso con media móvil, para cruzarlo.
 */
export function leerComposicion(
  medidas: MedidaCintura[],
  serie: PuntoTendencia[] = [],
): LecturaComposicion {
  const ordenadas = [...medidas].sort((a, b) => aFecha(a.fecha) - aFecha(b.fecha));

  if (ordenadas.length === 0) {
    return {
      lectura: "sin_medidas",
      titulo: "Todavía sin medidas",
      detalle:
        "La cintura es lo que separa perder grasa de perder músculo. Medite una vez por semana, siempre igual: en ayunas, de pie, a la altura del ombligo, después de soltar el aire sin meter la panza.",
      deltaCinturaCm: null,
      deltaPesoKg: null,
      dias: null,
    };
  }

  const ultima = ordenadas[ordenadas.length - 1];

  if (ordenadas.length === 1) {
    return {
      lectura: "primera",
      titulo: `Primera medida: ${ultima.cinturaCm} cm`,
      detalle:
        "Es el punto de partida. Con la próxima ya se puede comparar — tomala dentro de una o dos semanas, en las mismas condiciones que esta.",
      deltaCinturaCm: null,
      deltaPesoKg: null,
      dias: null,
    };
  }

  // La más vieja dentro de la ventana; si no hay ninguna, la más vieja que
  // exista. Comparar contra hace tres meses diría más de lo que se sabe.
  const corte = aFecha(ultima.fecha) - VENTANA_COMPARACION_DIAS * DIA_MS;
  const candidatas = ordenadas.slice(0, -1);
  const previa =
    candidatas.find((m) => aFecha(m.fecha) >= corte) ??
    candidatas[candidatas.length - 1];

  const dias = Math.round(
    (aFecha(ultima.fecha) - aFecha(previa.fecha)) / DIA_MS,
  );

  if (dias < DIAS_MINIMOS) {
    return {
      lectura: "muy_pronto",
      titulo: "Falta tiempo para comparar",
      detalle: `Entre las dos últimas medidas pasaron ${dias} ${dias === 1 ? "día" : "días"}. La grasa no se mueve tan rápido: lo que se vea antes de dos semanas es cómo quedó puesta la cinta, no el cuerpo.`,
      deltaCinturaCm: null,
      deltaPesoKg: null,
      dias,
    };
  }

  const deltaCintura = redondear(ultima.cinturaCm - previa.cinturaCm);

  const pesoAhora = tendenciaEn(serie, ultima.fecha);
  const pesoAntes = tendenciaEn(serie, previa.fecha);
  const deltaPeso =
    pesoAhora !== null && pesoAntes !== null
      ? redondear(pesoAhora - pesoAntes)
      : null;

  const cintura = direccion(deltaCintura, RUIDO_CINTURA_CM);
  const peso = deltaPeso === null ? null : direccion(deltaPeso, RUIDO_PESO_KG);

  const enSemanas = `en ${dias} días`;
  const cm = `${Math.abs(deltaCintura).toFixed(1)} cm`;
  const kg = deltaPeso === null ? "" : `${Math.abs(deltaPeso).toFixed(1)} kg`;

  const base = { deltaCinturaCm: deltaCintura, deltaPesoKg: deltaPeso, dias };

  // Sin peso con el que cruzar, se informa la cintura sola y ya.
  if (peso === null) {
    if (cintura === "baja")
      return { ...base, lectura: "grasa_bajando", titulo: `Cintura: −${cm} ${enSemanas}`, detalle: "Va bajando. Falta tendencia de peso para decir de dónde sale — pesate unos días seguidos y la lectura se completa." };
    if (cintura === "sube")
      return { ...base, lectura: "grasa_subiendo", titulo: `Cintura: +${cm} ${enSemanas}`, detalle: "Está subiendo. Falta tendencia de peso para cruzarlo." };
    return { ...base, lectura: "estable", titulo: `Cintura estable ${enSemanas}`, detalle: `Se movió menos de ${RUIDO_CINTURA_CM} cm, que es lo que se equivoca la cinta de una vez a otra. Sin cambio medible.` };
  }

  if (cintura === "baja" && peso === "baja")
    return { ...base, lectura: "grasa_bajando", titulo: "La grasa se está yendo", detalle: `Cintura −${cm} y tendencia de peso −${kg} ${enSemanas}. Las dos en la misma dirección: esto es pérdida de grasa, no de agua. El plan está funcionando.` };

  if (cintura === "baja")
    return { ...base, lectura: "recomposicion", titulo: "Recomposición: la balanza no lo ve", detalle: `La cintura bajó ${cm} pero el peso ${peso === "sube" ? `subió ${kg}` : "casi no se movió"}. Estás cambiando grasa por músculo. Es el caso en el que la balanza sola engaña y hace recortar calorías sin necesidad — acá no hace falta.` };

  if (cintura === "sube" && peso === "baja")
    return { ...base, lectura: "discordante", titulo: "Los dos números se contradicen", detalle: `La cintura subió ${cm} mientras el peso bajó ${kg}. Eso no suele pasar de verdad: lo más probable es que la cinta haya quedado en otro sitio o a otra altura. Volvé a medir mañana en ayunas antes de sacar conclusiones.` };

  if (cintura === "sube")
    return { ...base, lectura: "grasa_subiendo", titulo: "La cintura está subiendo", detalle: `Cintura +${cm} y peso ${peso === "sube" ? `+${kg}` : "estable"} ${enSemanas}. Si el objetivo es bajar grasa, el déficit no está siendo real: vale revisar las porciones estimadas antes que recortar más.` };

  // Cintura quieta.
  if (peso === "baja")
    return { ...base, lectura: "peso_sin_cintura", titulo: "Baja el peso, no la cintura", detalle: `El peso cayó ${kg} pero la cintura sigue igual ${enSemanas}. Puede ser agua, o puede ser masa magra. Si se repite, mirá que estés llegando a la proteína y que haya algo de fuerza en la semana.` };

  if (peso === "sube")
    return { ...base, lectura: "magra_subiendo", titulo: "Subís sin ensanchar", detalle: `Peso +${kg} con la cintura quieta ${enSemanas}. Si estás buscando masa muscular, así se ve cuando va bien.` };

  return { ...base, lectura: "estable", titulo: `Sin cambios ${enSemanas}`, detalle: `Cintura y peso se movieron menos de lo que se puede medir con confianza. Si el objetivo era mantener, esto es exactamente lo buscado; si era bajar, todavía no hay señal.` };
}

/**
 * Umbral del ratio cintura/estatura.
 *
 * Por encima de 0.50 se asocia con más riesgo cardiometabólico. Es una regla
 * gruesa —"la cintura, menos de la mitad de la estatura"— y por eso sirve:
 * no necesita báscula de bioimpedancia ni fórmula, solo una cinta métrica, y
 * distingue mejor que el IMC, que no sabe separar músculo de grasa.
 */
export const RATIO_UMBRAL = 0.5;

export interface RatioCintura {
  ratio: number;
  /** Cuántos cm de cintura faltan para llegar al umbral. 0 si ya está. */
  cmParaUmbral: number;
  bajoUmbral: boolean;
}

export function ratioCinturaEstatura(
  cinturaCm: number,
  estaturaCm: number | null | undefined,
): RatioCintura | null {
  if (!estaturaCm || estaturaCm <= 0) return null;
  const ratio = cinturaCm / estaturaCm;
  const objetivo = estaturaCm * RATIO_UMBRAL;
  return {
    ratio: Math.round(ratio * 1000) / 1000,
    cmParaUmbral: Math.max(0, Math.round((cinturaCm - objetivo) * 10) / 10),
    bajoUmbral: ratio <= RATIO_UMBRAL,
  };
}

function direccion(delta: number, ruido: number): "baja" | "sube" | "igual" {
  if (delta <= -ruido) return "baja";
  if (delta >= ruido) return "sube";
  return "igual";
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}
