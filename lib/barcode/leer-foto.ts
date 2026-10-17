/**
 * Leer el código de barras de una foto ya tomada.
 *
 * Se usa una foto y no la cámara en vivo por la misma razón que en toda la app:
 * la cámara en vivo pide permiso al navegador una y otra vez en el iPhone. La
 * foto sale de la cámara nativa del sistema, que no lo pide.
 *
 * Una foto de celular pesa 12 megapíxeles, y ZXing a ese tamaño es lento y a
 * veces peor que a menos. Se prueba a varias escalas, de la más probable a la
 * menos, y se devuelve el primer código que sale. Solo corre en el navegador.
 */
import { esCodigoValido } from "./openfoodfacts";

const ESCALAS = [1600, 2400, 1000];

export async function leerCodigoDeFoto(archivo: File): Promise<string | null> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);

  const pistas = new Map();
  pistas.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  // Más lento pero mucho más tolerante a un código algo torcido o borroso, que
  // es lo normal en una foto tomada a pulso.
  pistas.set(DecodeHintType.TRY_HARDER, true);
  const lector = new BrowserMultiFormatReader(pistas);

  const bitmap = await createImageBitmap(archivo);
  try {
    for (const lado of ESCALAS) {
      const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(bitmap.width * escala);
      lienzo.height = Math.round(bitmap.height * escala);
      lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

      const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.92));
      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      try {
        const resultado = await lector.decodeFromImageUrl(url);
        const codigo = resultado.getText();
        if (esCodigoValido(codigo)) return codigo;
      } catch {
        // No encontró un código a esta escala: se prueba la siguiente.
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}
