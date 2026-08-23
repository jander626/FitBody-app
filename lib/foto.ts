/**
 * Compresión de la foto antes de subirla.
 *
 * Se hace en el navegador a propósito. Una foto de celular pesa 3-5 MB y son
 * ~2500 tokens para el modelo; a 1024 px de lado mayor baja a ~200 KB y ~1600
 * tokens, sin que se note en la estimación —el modelo necesita reconocer el
 * plato, no leer la etiqueta. Es la palanca de costo y de latencia más grande
 * del registro por foto.
 */

/** Lado mayor de la imagen que se envía. */
export const LADO_MAXIMO = 1024;

/** Calidad JPEG. 0.8 es el punto donde dejan de verse artefactos. */
export const CALIDAD = 0.8;

export interface FotoComprimida {
  /** Base64 sin el prefijo `data:`. */
  base64: string;
  mediaType: "image/jpeg";
  /** Para subirla a Storage. */
  blob: Blob;
  anchoOriginal: number;
  altoOriginal: number;
  bytes: number;
}

/** Reduce y recodifica una foto a JPEG. */
export async function comprimirFoto(archivo: File): Promise<FotoComprimida> {
  const bitmap = await createImageBitmap(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo procesar la foto.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", CALIDAD),
  );
  if (!blob) throw new Error("No se pudo comprimir la foto.");

  const base64 = await blobABase64(blob);

  return {
    base64,
    mediaType: "image/jpeg",
    blob,
    anchoOriginal: bitmap.width,
    altoOriginal: bitmap.height,
    bytes: blob.size,
  };
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("No se pudo leer la foto."));
    lector.onload = () => {
      const resultado = lector.result;
      if (typeof resultado !== "string") {
        rechazar(new Error("No se pudo leer la foto."));
        return;
      }
      // "data:image/jpeg;base64,XXXX" → "XXXX"
      resolver(resultado.slice(resultado.indexOf(",") + 1));
    };
    lector.readAsDataURL(blob);
  });
}
