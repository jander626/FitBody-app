import "server-only";

import { clienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * URLs para ver las fotos de las comidas.
 *
 * El bucket es privado, así que no hay una URL fija: hay que firmarlas cada
 * vez. Se piden todas juntas —un día tiene cuatro o cinco comidas— porque
 * firmarlas de a una serían cinco viajes para pintar una pantalla.
 *
 * Duran una hora. Es de sobra para mirar el diario y lo bastante corto como
 * para que una URL que se filtre no sirva mañana. Vencida, la miniatura queda
 * rota; por eso las páginas que las usan no se cachean más que eso.
 */

export const VIGENCIA_SEGUNDOS = 3600;

/** De ruta de Storage a URL firmada. Las que fallen quedan afuera. */
export async function urlsDeFotos(
  rutas: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const limpias = [...new Set(rutas.filter((r): r is string => Boolean(r)))];
  if (limpias.length === 0) return new Map();

  const supabase = await clienteServidor();
  const { data, error } = await supabase.storage
    .from("comidas")
    .createSignedUrls(limpias, VIGENCIA_SEGUNDOS);

  // Una foto que no se puede firmar no es motivo para tumbar el diario: la
  // comida y sus números valen igual sin la imagen.
  if (error || !data) return new Map();

  const urls = new Map<string, string>();
  for (const fila of data) {
    const url = fila.signedUrl ?? fila.signedURL;
    if (fila.path && url && !fila.error) urls.set(fila.path, url);
  }
  return urls;
}
