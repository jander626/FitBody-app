/**
 * Consejos a partir de lo que la app ya sabe.
 *
 * Reglas sobre tus datos, no un modelo escribiendo párrafos. La diferencia
 * importa: cada consejo trae las cifras de las que sale, así que se puede
 * discutir. "Comé más proteína" no se puede discutir; "la proteína quedó corta
 * 5 de 7 días, promedio 118 de 160 g" sí — y si el número está mal, se ve.
 *
 * Dos reglas que se respetan en todo el archivo:
 *
 *  1. **Nada sin evidencia.** Un consejo que no puede citar números no se
 *     emite. Es la diferencia entre un asesor y una galleta de la fortuna.
 *  2. **Asociación no es causa.** Cuando dos series se mueven juntas —dormir
 *     poco y comer de más— se dice que van juntas, no que una causa la otra.
 *     Con doce días de datos no hay forma de saberlo, y afirmarlo sería
 *     inventar autoridad.
 *
 * Módulo puro: recibe los datos ya leídos y devuelve texto. Sin I/O.
 */

export interface DiaConsejo {
  fecha: string;
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
  comidas: number;
  /** Gasto con el que se calculó el déficit de ese día. */
  gastoKcal: number;
  /** Si ese gasto lo midió el reloj o salió de la fórmula. */
  gastoMedido: boolean;
  deficit: number;
}

export interface MetricaConsejo {
  fecha: string;
  pasos: number | null;
  suenoHoras: number | null;
  kcalTotales: number | null;
}

export interface EntradaConsejos {
  dias: DiaConsejo[];
  metricas: MetricaConsejo[];
  objetivo: { kcal: number; proteinaG: number } | null;
  /** El gasto por fórmula, para contrastarlo con el medido. */
  gastoEstimado: number | null;
}

export type Area = "calorias" | "proteina" | "gasto" | "actividad" | "sueno" | "registro";

export interface Consejo {
  id: string;
  area: Area;
  /** Menor es más urgente. Ordena la lista. */
  prioridad: number;
  titulo: string;
  detalle: string;
  /** Las cifras de las que sale. Se muestran al lado, no se esconden. */
  evidencia: string[];
}

/** Días que se miran hacia atrás. Una semana más un día de margen. */
export const VENTANA_DIAS = 8;

/**
 * Mínimo de días con registro para decir algo de una tendencia.
 *
 * Con menos, cualquier promedio lo domina un día suelto. Es preferible decir
 * "todavía no hay suficiente" que dar un número que no significa nada.
 */
export const DIAS_MINIMOS = 4;

const DIA_MS = 86_400_000;

function media(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

function r0(n: number): number {
  return Math.round(n);
}

function ultimos<T extends { fecha: string }>(filas: T[], dias: number): T[] {
  if (filas.length === 0) return [];
  const ordenados = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fin = Date.parse(`${ordenados[ordenados.length - 1].fecha}T00:00:00Z`);
  const corte = fin - (dias - 1) * DIA_MS;
  return ordenados.filter((f) => Date.parse(`${f.fecha}T00:00:00Z`) >= corte);
}

/**
 * Los consejos que los datos sostienen hoy, ya ordenados.
 *
 * Puede devolver una lista vacía, y está bien: cuando todo va como debe y no
 * hay nada que señalar, inventar una observación para llenar la pantalla le
 * quita valor a las veces que sí hay algo.
 */
export function generarConsejos(entrada: EntradaConsejos): Consejo[] {
  const { objetivo, gastoEstimado } = entrada;
  const dias = ultimos(entrada.dias, VENTANA_DIAS).filter((d) => d.comidas > 0);
  const metricas = ultimos(entrada.metricas, VENTANA_DIAS);

  const consejos: Consejo[] = [];

  if (dias.length < DIAS_MINIMOS) {
    consejos.push({
      id: "pocos-datos",
      area: "registro",
      prioridad: 0,
      titulo: "Todavía faltan días para leer una tendencia",
      detalle: `Hay ${dias.length} ${dias.length === 1 ? "día registrado" : "días registrados"} en la última semana. Con menos de ${DIAS_MINIMOS}, cualquier promedio lo decide un día suelto. Seguí registrando y esta pantalla se va llenando sola.`,
      evidencia: [`${dias.length} de ${VENTANA_DIAS} días con registro`],
    });
    return consejos;
  }

  consejos.push(...sobreCalorias(dias, objetivo));
  consejos.push(...sobreProteina(dias, objetivo));
  consejos.push(...sobreGasto(dias, gastoEstimado));
  consejos.push(...sobrePasos(metricas, dias));
  consejos.push(...sobreSueno(metricas, dias));
  consejos.push(...sobreRegistro(dias));

  return consejos.sort((a, b) => a.prioridad - b.prioridad);
}

// ------------------------------------------------------------ calorías ---

function sobreCalorias(
  dias: DiaConsejo[],
  objetivo: EntradaConsejos["objetivo"],
): Consejo[] {
  if (!objetivo) return [];

  const enObjetivo = dias.filter((d) => d.kcal <= objetivo.kcal * 1.05).length;
  const promedio = media(dias.map((d) => d.kcal));
  const conDeficit = dias.filter((d) => d.deficit > 0).length;

  // Lo que mueve el peso es el déficit, no cumplir el número exacto. Un día
  // por encima del objetivo pero por debajo del gasto sigue restando.
  if (enObjetivo >= dias.length - 1) {
    return [
      {
        id: "calorias-bien",
        area: "calorias",
        prioridad: 40,
        titulo: "El objetivo calórico se está cumpliendo",
        detalle: `${enObjetivo} de ${dias.length} días dentro del objetivo. Esta es la parte difícil y está resuelta: lo que queda es sostenerla.`,
        evidencia: [
          `promedio ${r0(promedio)} kcal de ${objetivo.kcal}`,
          `${conDeficit} de ${dias.length} días con déficit real`,
        ],
      },
    ];
  }

  const exceso = promedio - objetivo.kcal;
  return [
    {
      id: "calorias-por-encima",
      area: "calorias",
      prioridad: exceso > 200 ? 5 : 20,
      titulo:
        exceso > 0
          ? `El promedio va ${r0(exceso)} kcal por encima del objetivo`
          : "El objetivo se cumple algunos días sí y otros no",
      detalle:
        conDeficit === dias.length
          ? `Todos los días quedaron por debajo del gasto, así que el peso igual baja — solo más despacio de lo planeado. Antes de recortar más, vale revisar las porciones estimadas: un ${r0((exceso / objetivo.kcal) * 100)} % de más se explica con dos o tres porciones subestimadas.`
          : `${dias.length - conDeficit} de ${dias.length} días quedaron por encima del gasto: esos días no restaron nada. Suelen ser uno o dos, y son los que se llevan el déficit de toda la semana.`,
      evidencia: [
        `${enObjetivo} de ${dias.length} días en objetivo`,
        `promedio ${r0(promedio)} kcal de ${objetivo.kcal}`,
      ],
    },
  ];
}

// ------------------------------------------------------------ proteína ---

function sobreProteina(
  dias: DiaConsejo[],
  objetivo: EntradaConsejos["objetivo"],
): Consejo[] {
  if (!objetivo || objetivo.proteinaG <= 0) return [];

  const promedio = media(dias.map((d) => d.proteinaG));
  // 90 % cuenta como cumplido: la proteína es un piso al que se apunta, no una
  // cifra exacta, y exigir el 100 % convertiría un buen día en un fallo.
  const cumplidos = dias.filter(
    (d) => d.proteinaG >= objetivo.proteinaG * 0.9,
  ).length;
  const faltantes = dias.length - cumplidos;

  if (faltantes === 0) {
    return [
      {
        id: "proteina-bien",
        area: "proteina",
        prioridad: 45,
        titulo: "La proteína se está cumpliendo todos los días",
        detalle:
          "Es lo que más cuesta sostener en déficit y lo que decide si lo que se pierde es grasa o músculo.",
        evidencia: [`promedio ${r0(promedio)} g de ${objetivo.proteinaG}`],
      },
    ];
  }

  const brecha = objetivo.proteinaG - promedio;
  return [
    {
      id: "proteina-corta",
      area: "proteina",
      prioridad: faltantes >= dias.length / 2 ? 10 : 25,
      titulo: `La proteína quedó corta ${faltantes} de ${dias.length} días`,
      detalle: `Faltan ${r0(brecha)} g al día en promedio. En déficit, la proteína es lo que protege el músculo: sin ella, parte de lo que marca la balanza es masa magra, y eso la cintura lo delata antes que el peso. ${r0(brecha)} g son un huevo y medio, o 100 g de pollo, o un puñado de atún.`,
      evidencia: [
        `promedio ${r0(promedio)} g de ${objetivo.proteinaG}`,
        `${cumplidos} de ${dias.length} días al 90 % o más`,
      ],
    },
  ];
}

// --------------------------------------------------------------- gasto ---

function sobreGasto(
  dias: DiaConsejo[],
  gastoEstimado: number | null,
): Consejo[] {
  const medidos = dias.filter((d) => d.gastoMedido);

  if (medidos.length < DIAS_MINIMOS) {
    if (gastoEstimado === null) return [];
    return [
      {
        id: "gasto-sin-medir",
        area: "gasto",
        prioridad: 30,
        titulo: "El gasto sale de la fórmula, no del reloj",
        detalle: `Con ${medidos.length} ${medidos.length === 1 ? "día medido" : "días medidos"} de ${dias.length}, el déficit se calcula contra ${gastoEstimado} kcal fijas para todos los días — el mismo número camines 4.000 pasos o 16.000. Importar las calorías de Garmin cambia eso.`,
        evidencia: [`${medidos.length} de ${dias.length} días con gasto medido`],
      },
    ];
  }

  const promedioMedido = media(medidos.map((d) => d.gastoKcal));
  if (gastoEstimado === null) return [];

  const diferencia = promedioMedido - gastoEstimado;
  if (Math.abs(diferencia) < 100) {
    return [
      {
        id: "gasto-coincide",
        area: "gasto",
        prioridad: 50,
        titulo: "La fórmula le está acertando a tu gasto",
        detalle: `El reloj mide ${r0(promedioMedido)} kcal en promedio y la fórmula dice ${gastoEstimado}. La diferencia es menor que el error de cualquiera de los dos, así que el plan está calculado sobre un gasto razonable.`,
        evidencia: [
          `medido ${r0(promedioMedido)} kcal · fórmula ${gastoEstimado}`,
          `${medidos.length} días medidos`,
        ],
      },
    ];
  }

  const corta = diferencia > 0;
  return [
    {
      id: "gasto-difiere",
      area: "gasto",
      prioridad: 15,
      titulo: corta
        ? `Gastás ${r0(diferencia)} kcal más de lo que dice la fórmula`
        : `Gastás ${r0(-diferencia)} kcal menos de lo que dice la fórmula`,
      detalle: corta
        ? `El objetivo está calculado sobre ${gastoEstimado} kcal, pero el reloj mide ${r0(promedioMedido)}. Tu déficit real es mayor que el planeado, y eso explica bajar más rápido de lo esperado — o tener más hambre de la cuenta.`
        : `El objetivo está calculado sobre ${gastoEstimado} kcal y el reloj mide ${r0(promedioMedido)}. El déficit real es menor que el planeado, que es una de las razones por las que el peso puede moverse más lento de lo previsto.`,
      evidencia: [
        `medido ${r0(promedioMedido)} kcal · fórmula ${gastoEstimado}`,
        `${medidos.length} de ${dias.length} días medidos`,
      ],
    },
  ];
}

// ------------------------------------------------------------ actividad ---

function sobrePasos(
  metricas: MetricaConsejo[],
  dias: DiaConsejo[],
): Consejo[] {
  const conPasos = metricas.filter((m) => m.pasos !== null);
  if (conPasos.length < DIAS_MINIMOS) return [];

  const promedio = media(conPasos.map((m) => m.pasos!));

  // Los días de más movimiento contra los de menos, partidos por la mediana.
  // Con pocos días una media parte mal; la mediana deja mitad y mitad siempre.
  const ordenados = [...conPasos].sort((a, b) => a.pasos! - b.pasos!);
  const mediana = ordenados[Math.floor(ordenados.length / 2)].pasos!;

  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  const activos: number[] = [];
  const quietos: number[] = [];
  for (const m of conPasos) {
    const dia = porFecha.get(m.fecha);
    if (!dia) continue;
    (m.pasos! >= mediana ? activos : quietos).push(dia.deficit);
  }

  const evidencia = [`promedio ${r0(promedio).toLocaleString("es")} pasos`];

  if (activos.length >= 2 && quietos.length >= 2) {
    const dActivos = media(activos);
    const dQuietos = media(quietos);
    const brecha = dActivos - dQuietos;
    if (Math.abs(brecha) >= 100) {
      // El título sigue al signo. Que los días activos dejen MENOS déficit es
      // un resultado normal —moverse abre el apetito— y decir lo contrario
      // porque suena mejor sería mentir con los números al lado.
      const aFavor = brecha > 0;
      return [
        {
          id: "pasos-y-deficit",
          area: "actividad",
          prioridad: 35,
          titulo: aFavor
            ? "Los días que caminás más, el déficit es mayor"
            : "Los días que caminás más, el déficit es menor",
          detalle:
            `Partiendo la semana por la mediana de pasos, los días de más movimiento dejaron ${r0(dActivos)} kcal de déficit y los de menos, ${r0(dQuietos)}: ${r0(Math.abs(brecha))} kcal de diferencia. ` +
            (aFavor
              ? "Van juntas — no se puede decir desde acá cuánto es el gasto de caminar y cuánto es que esos días comés distinto."
              : "Moverse más abre el apetito, así que el gasto extra se está comiendo. No es un fallo: es la razón por la que el ejercicio solo rara vez alcanza para bajar de peso."),
          evidencia: [
            ...evidencia,
            `déficit ${r0(dActivos)} vs ${r0(dQuietos)} kcal`,
          ],
        },
      ];
    }
  }

  return [
    {
      id: "pasos-promedio",
      area: "actividad",
      prioridad: 55,
      titulo: `Vas en ${r0(promedio).toLocaleString("es")} pasos al día`,
      detalle:
        "Caminar es la parte del gasto que se puede subir sin que cueste recuperación, a diferencia de entrenar más fuerte.",
      evidencia,
    },
  ];
}

// ---------------------------------------------------------------- sueño ---

function sobreSueno(
  metricas: MetricaConsejo[],
  dias: DiaConsejo[],
): Consejo[] {
  const conSueno = metricas.filter((m) => m.suenoHoras !== null);
  if (conSueno.length < DIAS_MINIMOS) return [];

  const promedio = media(conSueno.map((m) => m.suenoHoras!));
  const cortas = conSueno.filter((m) => m.suenoHoras! < 6);

  const evidencia = [`promedio ${promedio.toFixed(1)} h`];

  // Dormir poco y comer de más suelen ir juntos. Solo se dice si hay al menos
  // dos noches de cada lado; con una, es una anécdota con formato de dato.
  if (cortas.length >= 2 && conSueno.length - cortas.length >= 2) {
    const porFecha = new Map(dias.map((d) => [d.fecha, d]));
    const tras = (lista: MetricaConsejo[]) =>
      lista.map((m) => porFecha.get(m.fecha)?.kcal).filter((k): k is number => k !== undefined);

    const kcalCortas = tras(cortas);
    const kcalLargas = tras(conSueno.filter((m) => m.suenoHoras! >= 6));

    if (kcalCortas.length >= 2 && kcalLargas.length >= 2) {
      const brecha = media(kcalCortas) - media(kcalLargas);
      if (brecha >= 150) {
        return [
          {
            id: "sueno-y-comida",
            area: "sueno",
            prioridad: 20,
            titulo: `Las noches de menos de 6 h coinciden con comer ${r0(brecha)} kcal más`,
            detalle: `${cortas.length} noches por debajo de 6 h. Esos días el promedio fue ${r0(media(kcalCortas))} kcal contra ${r0(media(kcalLargas))} de los demás. Son series que van juntas: con esta cantidad de días no se puede afirmar que una cause la otra, pero vale la pena mirarlo.`,
            evidencia: [
              ...evidencia,
              `${r0(media(kcalCortas))} vs ${r0(media(kcalLargas))} kcal`,
              `${cortas.length} noches cortas de ${conSueno.length}`,
            ],
          },
        ];
      }
    }
  }

  if (promedio < 6.5) {
    return [
      {
        id: "sueno-corto",
        area: "sueno",
        prioridad: 30,
        titulo: `Estás durmiendo ${promedio.toFixed(1)} h en promedio`,
        detalle:
          "Dormir poco sostenidamente sube el hambre y baja la recuperación del entrenamiento. Es la palanca más barata de las que quedan: no cuesta esfuerzo ni cambia la comida.",
        evidencia: [...evidencia, `${cortas.length} noches por debajo de 6 h`],
      },
    ];
  }

  return [
    {
      id: "sueno-bien",
      area: "sueno",
      prioridad: 60,
      titulo: `Dormís ${promedio.toFixed(1)} h en promedio`,
      detalle: "Está en el rango donde el hambre y la recuperación no se resienten.",
      evidencia,
    },
  ];
}

// ------------------------------------------------------------- registro ---

function sobreRegistro(dias: DiaConsejo[]): Consejo[] {
  const faltan = VENTANA_DIAS - dias.length;
  if (faltan <= 1) return [];

  return [
    {
      id: "dias-sin-registrar",
      area: "registro",
      prioridad: 12,
      titulo: `${faltan} días de la última semana quedaron sin registrar`,
      detalle:
        "Los días que faltan no son neutros para el promedio: son desconocidos. Y suelen ser justo los distintos —una salida, un asado— que es cuando el dato más valdría.",
      evidencia: [`${dias.length} de ${VENTANA_DIAS} días con registro`],
    },
  ];
}
