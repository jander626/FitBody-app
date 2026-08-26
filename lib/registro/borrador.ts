/**
 * El borrador de un registro a medio hacer.
 *
 * Una estimación por foto cuesta una llamada al modelo —y el cupo gratis son
 * 20 al día—, así que perderla no es perder tipeo: es perder una de las veinte.
 * Se perdía de dos formas: cambiando a la pestaña de buscar en la tabla, que
 * desmontaba el formulario, y con iOS descartando la página al cambiar de app.
 * Lo primero se arregló montando las dos pestañas a la vez; lo segundo necesita
 * que el borrador viva fuera de la memoria de React, que es lo que hay acá.
 *
 * Se guarda en dos llaves a propósito. La foto pesa ~270 KB en base64 y cambia
 * una vez; el resto pesa unos pocos KB y cambia en cada tecla. Juntas, escribir
 * la descripción reescribiría la foto entera letra por letra.
 *
 * La parte de interpretar y empaquetar es pura y está testeada. Las funciones
 * que tocan `localStorage` son envoltorios finos, porque ahí no hay nada que
 * razonar salvo que puede lanzar (Safari en privado lo hace).
 */
import { z } from "zod";
import { ItemBorradorSchema, MOMENTOS } from "./tipos";

export const CLAVE_BORRADOR = "fitfood-borrador";
export const CLAVE_FOTO = "fitfood-borrador-foto";

/** Sube cuando la forma cambie: un borrador viejo se descarta, no se migra. */
export const VERSION = 1;

/**
 * Cuánto vale un borrador antes de estorbar.
 *
 * Seis horas cubre "dejé el almuerzo a medias y volví en la tarde" sin llegar
 * a resucitar la cena de anoche cuando abrís la app en el desayuno.
 */
export const VIGENCIA_MS = 6 * 60 * 60 * 1000;

const EstimacionSchema = z.object({
  sessionId: z.string(),
  momento: z.enum(MOMENTOS),
  confianza: z.enum(["alta", "media", "baja"]),
  preguntas: z.array(z.string()),
  nota: z.string(),
  turnosRestantes: z.number(),
});

export type Estimacion = z.infer<typeof EstimacionSchema>;

/** Lo que se conserva de un registro a medio hacer. */
export const BorradorSchema = z.object({
  v: z.literal(VERSION),
  guardadoEn: z.number(),
  /** El día al que pertenece. Ver `interpretar`. */
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  texto: z.string(),
  momento: z.enum(MOMENTOS),
  estimacion: EstimacionSchema.nullable(),
  items: z.array(ItemBorradorSchema),
});

export type Borrador = z.infer<typeof BorradorSchema>;

/** Lo que pone quien guarda: la versión y la hora las pone el módulo. */
export type DatosBorrador = Omit<Borrador, "v" | "guardadoEn">;

/** ¿Hay algo que valga la pena recuperar? Un formulario vacío no lo es. */
export function tieneAlgo(datos: DatosBorrador): boolean {
  return (
    datos.items.length > 0 ||
    datos.estimacion !== null ||
    datos.texto.trim().length > 0
  );
}

export function empaquetar(
  datos: DatosBorrador,
  ahora: number = Date.now(),
): string {
  return JSON.stringify({ ...datos, v: VERSION, guardadoEn: ahora });
}

/**
 * El borrador guardado, si todavía sirve. Null en cualquier otro caso.
 *
 * Se descarta cuando la fecha no es la de la pantalla. Podría restaurarse
 * conservando la fecha del borrador, pero entonces guardar escribiría en un
 * día distinto del que se está viendo — que es exactamente la confusión que
 * acaba de costar mover una cena a mano. Entre perder un borrador raro y
 * escribir en el día equivocado en silencio, se pierde el borrador.
 */
export function interpretar(
  cadena: string | null | undefined,
  opciones: { fecha: string; ahora?: number },
): DatosBorrador | null {
  if (!cadena) return null;

  let crudo: unknown;
  try {
    crudo = JSON.parse(cadena);
  } catch {
    return null;
  }

  const analizado = BorradorSchema.safeParse(crudo);
  // Incluye la versión vieja y el ítem corrupto: si una parte no cuadra, no
  // hay forma de saber qué más está mal. Se descarta entero.
  if (!analizado.success) return null;

  const { v: _v, guardadoEn, ...datos } = analizado.data;
  void _v;

  if (datos.fecha !== opciones.fecha) return null;

  const ahora = opciones.ahora ?? Date.now();
  // El futuro también se descarta: significa que el reloj se movió, y no hay
  // forma de saber cuán viejo es en realidad.
  if (guardadoEn > ahora || ahora - guardadoEn > VIGENCIA_MS) return null;

  return tieneAlgo(datos) ? datos : null;
}

// --------------------------------------------------------- localStorage ---

/** Todo lo de acá abajo puede lanzar y no importa: el borrador es un extra. */
function conAlmacen<T>(accion: (almacen: Storage) => T, siFalla: T): T {
  try {
    if (typeof window === "undefined") return siFalla;
    return accion(window.localStorage);
  } catch {
    return siFalla;
  }
}

export function guardarBorrador(datos: DatosBorrador): void {
  conAlmacen((almacen) => {
    if (!tieneAlgo(datos)) {
      almacen.removeItem(CLAVE_BORRADOR);
      return;
    }
    almacen.setItem(CLAVE_BORRADOR, empaquetar(datos));
  }, undefined);
}

export function leerBorrador(opciones: {
  fecha: string;
  ahora?: number;
}): DatosBorrador | null {
  return conAlmacen(
    (almacen) => interpretar(almacen.getItem(CLAVE_BORRADOR), opciones),
    null,
  );
}

/**
 * La foto va aparte y sin validar: es una cadena base64, y lo peor que puede
 * pasar si está corrupta es que la vista previa no cargue.
 */
export function guardarFoto(base64: string | null): void {
  conAlmacen((almacen) => {
    if (base64 === null) {
      almacen.removeItem(CLAVE_FOTO);
      return;
    }
    almacen.setItem(CLAVE_FOTO, base64);
  }, undefined);
}

export function leerFoto(): string | null {
  return conAlmacen((almacen) => almacen.getItem(CLAVE_FOTO), null);
}

export function limpiarBorrador(): void {
  conAlmacen((almacen) => {
    almacen.removeItem(CLAVE_BORRADOR);
    almacen.removeItem(CLAVE_FOTO);
  }, undefined);
}
