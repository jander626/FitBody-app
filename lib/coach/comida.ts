/**
 * Lo que se puede decir de una comida mientras se está registrando.
 *
 * Todo esto se calcula, no se le pregunta a un modelo. Tres razones: el cupo
 * gratis son 20 llamadas al día y las comidas ya usan buena parte; una llamada
 * por tecla no existe como idea; y un modelo produciría números plausibles y
 * equivocados, que es peor que no decir nada. Acá cada frase trae la cifra de
 * la que sale, y esa cifra viene del plato que estás mirando.
 *
 * **Lo que esta app no sabe:** la tabla de alimentos tiene calorías y los tres
 * macros, nada más. No hay fibra, ni sodio, ni micronutrientes. Así que acá no
 * se dice si una comida es "sana" —eso no se deduce de cuatro números—, se dice
 * cómo encaja con tu objetivo del día y cuánta proteína trae, que es lo que los
 * datos sí sostienen.
 */
import type { Totales } from "@/lib/registro/tipos";
import { MOMENTOS } from "@/lib/registro/tipos";

export type Momento = (typeof MOMENTOS)[number];

/** Cuántas comidas grandes suelen venir después de esta. */
const COMIDAS_DESPUES: Record<Momento, number> = {
  desayuno: 2,
  snack: 2,
  almuerzo: 1,
  postre: 1,
  bebida: 1,
  cena: 0,
  otro: 1,
};

export type Tono = "bien" | "atencion" | "info";

export interface Senal {
  id: string;
  tono: Tono;
  texto: string;
}

export interface ContextoComida {
  /** El objetivo activo. Sin él casi no hay nada que comparar. */
  objetivo: Totales | null;
  /** Lo ya registrado hoy, sin contar esta comida. */
  consumido: Totales;
  momento: Momento;
}

/** El 5 % de margen del resto de la app: pasarse por 40 kcal no es pasarse. */
const MARGEN = 1.05;

/** Debajo de esto, una comida con calorías aporta poca proteína. */
const PROTEINA_FLOJA_G = 10;
/** Y arriba de esto, aporta bastante. Son ~1/5 del día de alguien de 80 kg. */
const PROTEINA_BUENA_G = 25;
/** Calorías desde las que vale la pena mirar la proteína de la comida. */
const KCAL_COMIDA_SERIA = 300;

function r0(n: number): number {
  return Math.round(n);
}

/**
 * Señales sobre la comida que se está armando.
 *
 * Devuelve de cero a tres, ordenadas por lo que más importa. Tres es el tope a
 * propósito: una lista larga de observaciones tibias no se lee, y la que
 * importa se pierde entre las demás.
 */
export function leerComida(
  comida: Totales,
  ctx: ContextoComida,
  maximo = 3,
): Senal[] {
  if (comida.kcal <= 0) return [];

  const { objetivo, consumido, momento } = ctx;

  if (!objetivo) {
    return [
      {
        id: "sin-objetivo",
        tono: "info",
        texto:
          "Sin un objetivo configurado no se puede decir si esto encaja. Calculá tu plan en Perfil y esta tarjeta empieza a servir.",
      },
    ];
  }

  const senales: Senal[] = [];
  const restantes = COMIDAS_DESPUES[momento] ?? 1;

  // --- calorías -----------------------------------------------------------
  const kcalTotal = consumido.kcal + comida.kcal;
  const sobra = objetivo.kcal - kcalTotal;

  if (kcalTotal > objetivo.kcal * MARGEN) {
    senales.push({
      id: "kcal-excedido",
      tono: "atencion",
      texto: `Con esto el día queda en ${r0(kcalTotal)} kcal: ${r0(-sobra)} por encima del objetivo${restantes > 0 ? ", y todavía falta comer" : ""}.`,
    });
  } else if (restantes > 0 && sobra < 250 * restantes) {
    // Queda dentro, pero lo que sobra no alcanza para lo que falta del día.
    senales.push({
      id: "kcal-justo",
      tono: "atencion",
      texto: `Quedás en ${r0(kcalTotal)} de ${objetivo.kcal} kcal. Sobran ${r0(sobra)} para ${restantes === 1 ? "la comida que falta" : `las ${restantes} comidas que faltan`}: va justo.`,
    });
  } else {
    senales.push({
      id: "kcal-encaja",
      tono: "bien",
      texto: `Quedás en ${r0(kcalTotal)} de ${objetivo.kcal} kcal — te sobran ${r0(sobra)}.`,
    });
  }

  // --- proteína -----------------------------------------------------------
  // Va segunda porque es la que se persigue hacia arriba: en déficit, es lo que
  // decide si lo que se pierde es grasa o músculo.
  const protTotal = consumido.proteinaG + comida.proteinaG;
  const faltaProt = objetivo.proteinaG - protTotal;
  const aportoBien = comida.proteinaG >= PROTEINA_BUENA_G;

  if (aportoBien) {
    senales.push({
      id: "proteina-buena",
      tono: "bien",
      texto:
        faltaProt > 0
          ? `${r0(comida.proteinaG)} g de proteína: buen aporte. Vas en ${r0(protTotal)} de ${objetivo.proteinaG} g.`
          : `${r0(comida.proteinaG)} g de proteína: con esto ya cubriste los ${objetivo.proteinaG} g del día.`,
    });
  } else if (
    comida.kcal >= KCAL_COMIDA_SERIA &&
    comida.proteinaG < PROTEINA_FLOJA_G
  ) {
    senales.push({
      id: "proteina-floja",
      tono: "atencion",
      texto: `${r0(comida.kcal)} kcal con ${r0(comida.proteinaG)} g de proteína. Si le cabe un huevo, atún, pollo o queso, sube el aporte sin cambiar mucho el resto.`,
    });
  }

  if (faltaProt > 0 && restantes === 0) {
    senales.push({
      id: "proteina-ultima",
      tono: "atencion",
      texto: `Cerrando el día te faltarían ${r0(faltaProt)} g de proteína de los ${objetivo.proteinaG}.`,
    });
  } else if (faltaProt > 0 && restantes > 0 && !aportoBien) {
    // Solo si esta comida no aportó bien. Decirle "todavía falta mucho" a
    // quien acaba de meter 46 g de proteína es cierto y desmoralizante: la
    // señal de que va bien ya lleva el número que falta.
    const porComida = faltaProt / restantes;
    if (porComida > 45) {
      senales.push({
        id: "proteina-cuesta-arriba",
        tono: "atencion",
        texto: `Faltan ${r0(faltaProt)} g de proteína y ${restantes === 1 ? "una comida" : `${restantes} comidas`}: son ${r0(porComida)} g por comida, que es bastante.`,
      });
    }
  }

  // --- de dónde vienen las calorías --------------------------------------
  // Sin fibra ni micronutrientes en la tabla, el reparto de macros es lo único
  // que se puede decir del "qué" además del "cuánto". Se dice como dato, no
  // como reproche: una comida con mucha grasa no está mal por eso.
  const deGrasa = (comida.grasaG * 9) / comida.kcal;
  const deCarbs = (comida.carbsG * 4) / comida.kcal;

  if (deGrasa > 0.55) {
    senales.push({
      id: "mucha-grasa",
      tono: "info",
      texto: `El ${Math.round(deGrasa * 100)} % de estas calorías viene de la grasa. No es un problema en sí, pero llena menos por caloría que la proteína.`,
    });
  } else if (deCarbs > 0.7 && comida.proteinaG < PROTEINA_BUENA_G) {
    senales.push({
      id: "muchos-carbos",
      tono: "info",
      texto: `El ${Math.round(deCarbs * 100)} % viene de carbohidratos y hay poca proteína. Suele dar hambre antes que una comida más repartida.`,
    });
  }

  return ordenar(senales).slice(0, maximo);
}

/** Lo que exige acción primero; lo que va bien, al final. */
const PESO_TONO: Record<Tono, number> = { atencion: 0, info: 1, bien: 2 };

function ordenar(senales: Senal[]): Senal[] {
  return [...senales].sort((a, b) => PESO_TONO[a.tono] - PESO_TONO[b.tono]);
}
