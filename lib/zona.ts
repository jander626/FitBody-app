/**
 * Qué día es "hoy" para quien está mirando.
 *
 * Toda la app venía calculando la fecha con `toISOString()`, que devuelve UTC.
 * En Colombia eso significa que a partir de las 7 de la tarde el servidor ya
 * está en el día siguiente: una cena registrada a las 8:48 PM del martes
 * aparecía el miércoles, y el martes quedaba con menos calorías de las que
 * fueron. No es un detalle cosmético — descuadra el déficit de dos días.
 *
 * La zona viene del navegador, que la sabe con certeza, y viaja en una cookie
 * para que el servidor pueda usarla al renderizar. Es por dispositivo a
 * propósito: si viajás, el teléfono cambia de zona y la app lo sigue sin que
 * haya que tocar nada.
 *
 * Módulo puro: no lee cookies ni toca red. Eso lo hace `lib/datos/diario.ts`.
 */

export const COOKIE_ZONA = "fitfood-zona";

/**
 * A dónde caer cuando no hay cookie —el primer render, antes de que el
 * navegador la escriba— o cuando lo que llegó no es una zona válida.
 *
 * No es UTC a propósito: UTC está *garantizadamente* mal para quien usa esto,
 * mientras que la zona de casa está bien casi siempre. Se cambia con
 * FITFOOD_ZONA_HORARIA.
 */
export const ZONA_POR_DEFECTO = "America/Bogota";

/**
 * Si el navegador (o quien sea) mandó algo que Intl entiende.
 *
 * La cookie llega del cliente, así que es entrada no confiable: un valor
 * inventado haría lanzar a `Intl.DateTimeFormat` y tumbaría el render de la
 * pantalla entera.
 */
export function esZonaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** La zona a usar: la pedida si sirve, si no la de configuración. */
export function zonaSegura(
  pedida: string | undefined | null,
  env: Record<string, string | undefined> = {},
): string {
  if (pedida && esZonaValida(pedida)) return pedida;

  const configurada = env.FITFOOD_ZONA_HORARIA?.trim();
  if (configurada && esZonaValida(configurada)) return configurada;

  return ZONA_POR_DEFECTO;
}

/**
 * La fecha de un instante, en una zona, como AAAA-MM-DD.
 *
 * `en-CA` no es una elección estética: es el único idioma común cuyo formato
 * corto de fecha ya es AAAA-MM-DD, así que evita tener que armar la cadena a
 * mano con `getFullYear` y compañía — que es justo donde se cuela el error de
 * usar la zona del servidor en vez de la pedida.
 */
export function fechaEnZona(zona: string, instante: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}
