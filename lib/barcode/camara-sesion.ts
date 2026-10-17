/**
 * La cámara trasera, pedida una sola vez por apertura de la app.
 *
 * En el iPhone cada `getUserMedia` nuevo vuelve a preguntar el permiso. Para
 * pedirlo una vez, el flujo base se guarda a nivel de módulo (vive mientras no
 * se recargue la página, aunque se cambie de pantalla) y no se detiene nunca:
 * solo se apaga con `enabled = false`, que baja la luz de la cámara sin soltar
 * el permiso.
 *
 * Cada lector trabaja sobre un clon del flujo base, así puede detenerlo al
 * salir sin tocar el original.
 */
let base: MediaStream | null = null;

function estaViva(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === "live");
}

/** Un flujo de video listo para usar; el llamador debe detenerlo al terminar. */
export async function abrirCamara(): Promise<MediaStream> {
  if (!estaViva(base)) {
    base = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    base.getVideoTracks().forEach((t) => (t.enabled = false));
  }
  const clon = base.clone();
  clon.getVideoTracks().forEach((t) => (t.enabled = true));
  return clon;
}

/** El permiso ya se concedió en esta apertura de la app. */
export function camaraLista(): boolean {
  return estaViva(base);
}
