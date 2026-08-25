/**
 * Lectura de los CSV que exporta Garmin Connect.
 *
 * Garmin no exporta un archivo con todo: exporta un informe por métrica, cada
 * uno con su propio rango de fechas, su propio formato de fecha y su propia
 * forma de decir "este día no hay dato". Esto los normaliza a una fila por día.
 *
 * Lo que se aprendió mirando exports reales, y que se paga si se ignora:
 *
 *  - Todos empiezan con un BOM (﻿). Sin sacarlo, la primera cabecera no
 *    coincide con nada y el archivo entero se lee como vacío.
 *  - La columna de fecha **no tiene nombre** en pasos y actividades, y en
 *    sueño se llama "Puntuación de sueño 4 semanas", que no es una fecha.
 *  - Pasos usa MM/DD/YYYY; sueño usa YYYY-MM-DD. En el mismo export.
 *  - Los huecos son "--", no vacío.
 *  - La duración del sueño viene como "6h 58min", no como número.
 *  - Los rangos se solapan (un archivo va del 15/7 al 9/8 y otro del 27/7 al
 *    23/8), así que fusionar por fecha no es opcional.
 */

export type Metrica = "pasos" | "sueno" | "calorias" | "actividades";

export interface DiaMetrica {
  fecha: string;
  pasos?: number;
  pasosObjetivo?: number;
  suenoHoras?: number;
  suenoCalidad?: string;
  suenoPuntuacion?: number;
  fcReposo?: number;
  bodyBattery?: number;
  kcalActivas?: number;
  kcalTotales?: number;
}

export interface Lectura {
  metrica: Metrica;
  dias: DiaMetrica[];
  /** Líneas que no se pudieron leer, para poder decirlo en pantalla. */
  ignoradas: number;
}

// ------------------------------------------------------------------ CSV ---

/** Parte una línea de CSV respetando las comillas. */
export function partirLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let enComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (enComillas) {
      if (c === '"') {
        // Dos comillas seguidas son una comilla literal.
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else enComillas = false;
      } else actual += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      campos.push(actual);
      actual = "";
    } else actual += c;
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

/** "--", "" y variantes son huecos, no ceros. */
function hayDato(v: string | undefined): v is string {
  return v !== undefined && v !== "" && v !== "--" && v !== "—";
}

function aNumero(v: string | undefined): number | undefined {
  if (!hayDato(v)) return undefined;
  // Garmin mete separadores de miles según el idioma del navegador.
  const limpio = v.replace(/\.(?=\d{3}\b)/g, "").replace(/[  ,](?=\d{3}\b)/g, "");
  const n = Number(limpio.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * "6h 58min" → 6.97. También acepta "6:58" y "6,5".
 *
 * Devuelve horas con dos decimales: la columna es numeric(4,2) y guardar más
 * precisión de la que se puede almacenar hace que lo leído y lo guardado no
 * coincidan.
 */
export function aHoras(v: string | undefined): number | undefined {
  if (!hayDato(v)) return undefined;

  const hm = v.match(/(\d+)\s*h(?:\D*(\d+)\s*m)?/i);
  if (hm) {
    const horas = Number(hm[1]) + (hm[2] ? Number(hm[2]) / 60 : 0);
    return Math.round(horas * 100) / 100;
  }

  const reloj = v.match(/^(\d+):(\d{2})$/);
  if (reloj) {
    return Math.round((Number(reloj[1]) + Number(reloj[2]) / 60) * 100) / 100;
  }

  const n = aNumero(v);
  return n === undefined ? undefined : Math.round(n * 100) / 100;
}

/**
 * Normaliza las dos formas de fecha que aparecen, a ISO.
 *
 * MM/DD/YYYY es el formato de los informes de pasos y actividades;
 * YYYY-MM-DD el del de sueño. No se intenta adivinar DD/MM: Garmin exporta en
 * formato de Estados Unidos aunque la interfaz esté en castellano, y adivinar
 * convertiría el 3 de julio en el 7 de marzo sin que nadie se entere.
 */
export function aFechaISO(v: string | undefined): string | undefined {
  if (!hayDato(v)) return undefined;

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return v;

  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mes, dia, anio] = us;
    if (Number(mes) > 12) return undefined; // no es MM/DD: no se adivina
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  return undefined;
}

// -------------------------------------------------------------- métricas ---

function normalizar(s: string): string {
  return s
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Qué informe es este archivo.
 *
 * Primero por la cabecera, que es lo que de verdad describe el contenido. El
 * nombre del archivo solo desempata entre pasos y calorías, que Garmin exporta
 * con la **misma** cabecera (`,Actuales,Objetivo`) y solo se distinguen por
 * cómo se llama el archivo.
 */
export function detectarMetrica(
  texto: string,
  nombreArchivo = "",
): Metrica | null {
  const primera = normalizar(texto.split(/\r?\n/)[0] ?? "");
  const nombre = normalizar(nombreArchivo);

  if (primera.includes("sueno") || primera.includes("body battery")) {
    return "sueno";
  }
  if (primera.includes("tipo de actividad")) return "actividades";

  if (primera.includes("actuales") && primera.includes("objetivo")) {
    // Misma cabecera para pasos y calorías: decide el nombre del archivo.
    if (/calor|kcal/.test(nombre)) return "calorias";
    if (/paso|step/.test(nombre)) return "pasos";
    return null;
  }

  return null;
}

/**
 * Índice de una columna por nombre aproximado.
 *
 * La búsqueda arranca en 1 a propósito: la columna 0 es siempre la fecha, y en
 * el informe de sueño se llama "Puntuación de sueño 4 semanas" — o sea que
 * buscar "puntuación" la encuentra a ella antes que a la columna real.
 */
function columna(cabeceras: string[], ...claves: string[]): number {
  for (let i = 1; i < cabeceras.length; i++) {
    const n = normalizar(cabeceras[i]);
    if (claves.some((k) => n.includes(normalizar(k)))) return i;
  }
  return -1;
}

/**
 * Lee un archivo ya clasificado.
 *
 * `metrica` se pasa aparte en vez de detectarse acá porque la pantalla deja
 * corregir la detección: un archivo renombrado no debería obligar a exportar
 * de nuevo.
 */
export function leerCsv(texto: string, metrica: Metrica): Lectura {
  const lineas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  if (lineas.length < 2) return { metrica, dias: [], ignoradas: 0 };

  const cabeceras = partirLinea(lineas[0]);
  const dias: DiaMetrica[] = [];
  let ignoradas = 0;

  // La fecha siempre va en la primera columna, tenga el nombre que tenga.
  for (const linea of lineas.slice(1)) {
    const campos = partirLinea(linea);
    const fecha = aFechaISO(campos[0]);
    if (!fecha) {
      ignoradas++;
      continue;
    }

    const dia: DiaMetrica = { fecha };

    if (metrica === "pasos") {
      dia.pasos = aNumero(campos[1]);
      dia.pasosObjetivo = aNumero(campos[2]);
    } else if (metrica === "calorias") {
      // El informe de calorías trae el total del día en "Actuales".
      dia.kcalTotales = aNumero(campos[1]);
    } else if (metrica === "sueno") {
      const i = {
        puntuacion: columna(cabeceras, "puntuacion"),
        fc: columna(cabeceras, "frecuencia cardiaca"),
        battery: columna(cabeceras, "body battery"),
        calidad: columna(cabeceras, "calidad"),
        duracion: columna(cabeceras, "duracion"),
      };
      dia.suenoPuntuacion = i.puntuacion > 0 ? aNumero(campos[i.puntuacion]) : undefined;
      dia.fcReposo = i.fc > 0 ? aNumero(campos[i.fc]) : undefined;
      dia.bodyBattery = i.battery > 0 ? aNumero(campos[i.battery]) : undefined;
      dia.suenoHoras = i.duracion > 0 ? aHoras(campos[i.duracion]) : undefined;
      const calidad = i.calidad > 0 ? campos[i.calidad] : undefined;
      dia.suenoCalidad = hayDato(calidad) ? calidad : undefined;
    } else {
      // Actividades: un conteo por tipo, sin nada que sumar a la fila del día.
      ignoradas++;
      continue;
    }

    // Una fila con fecha y ningún dato no aporta: no se guarda un día vacío.
    // Se cuentan los valores definidos, no las claves: asignar `undefined`
    // crea la clave igual, así que una noche entera en "--" parecería llena.
    const conDato = Object.entries(dia).filter(
      ([clave, valor]) => clave !== "fecha" && valor !== undefined,
    );
    if (conDato.length === 0) {
      ignoradas++;
      continue;
    }
    dias.push(dia);
  }

  return { metrica, dias, ignoradas };
}

/**
 * Junta varios informes en una fila por día.
 *
 * Los rangos se solapan y el mismo día aparece en más de un archivo. Gana el
 * dato presente sobre el ausente; entre dos presentes gana el último leído,
 * que es el del export más reciente si se suben en orden.
 */
export function fusionar(lecturas: Lectura[]): DiaMetrica[] {
  const porFecha = new Map<string, DiaMetrica>();

  for (const lectura of lecturas) {
    for (const dia of lectura.dias) {
      const previo = porFecha.get(dia.fecha);
      porFecha.set(dia.fecha, previo ? combinar(previo, dia) : dia);
    }
  }

  return [...porFecha.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Campo a campo, gana el nuevo si trae dato. Escrito a mano para que
 * agregar una métrica a `DiaMetrica` sin fusionarla no compile. */
function combinar(viejo: DiaMetrica, nuevo: DiaMetrica): DiaMetrica {
  return {
    fecha: viejo.fecha,
    pasos: nuevo.pasos ?? viejo.pasos,
    pasosObjetivo: nuevo.pasosObjetivo ?? viejo.pasosObjetivo,
    suenoHoras: nuevo.suenoHoras ?? viejo.suenoHoras,
    suenoCalidad: nuevo.suenoCalidad ?? viejo.suenoCalidad,
    suenoPuntuacion: nuevo.suenoPuntuacion ?? viejo.suenoPuntuacion,
    fcReposo: nuevo.fcReposo ?? viejo.fcReposo,
    bodyBattery: nuevo.bodyBattery ?? viejo.bodyBattery,
    kcalActivas: nuevo.kcalActivas ?? viejo.kcalActivas,
    kcalTotales: nuevo.kcalTotales ?? viejo.kcalTotales,
  };
}
