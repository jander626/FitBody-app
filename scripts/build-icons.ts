/**
 * Genera los PNG de la PWA a partir de assets/icon.svg.
 * Los PNG se versionan: el manifest los referencia y no queremos que el build
 * dependa de sharp. Correr `npm run iconos` solo cuando cambie el SVG.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SALIDA = path.join(RAIZ, "public", "icons");

/** El icono maskable se encoge para que nada quede fuera de la zona segura. */
const SALIDAS = [
  { archivo: "icon-192.png", tamano: 192, relleno: 0 },
  { archivo: "icon-512.png", tamano: 512, relleno: 0 },
  { archivo: "apple-touch-icon.png", tamano: 180, relleno: 0 },
  { archivo: "icon-maskable-512.png", tamano: 512, relleno: 52 },
];

async function main() {
  const svg = await readFile(path.join(RAIZ, "assets", "icon.svg"));
  await mkdir(SALIDA, { recursive: true });

  for (const { archivo, tamano, relleno } of SALIDAS) {
    const interior = tamano - relleno * 2;
    const png = await sharp(svg, { density: 384 })
      .resize(interior, interior)
      .extend({
        top: relleno,
        bottom: relleno,
        left: relleno,
        right: relleno,
        background: "#C77A1E",
      })
      .png()
      .toBuffer();
    await writeFile(path.join(SALIDA, archivo), png);
    console.log(`✓ ${archivo} (${tamano}×${tamano})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
