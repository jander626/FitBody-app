/**
 * Mide cuánto acierta la estimación contra los datos reales de la bitácora.
 *
 * Los JSON de `data/comidas/` **ya son etiquetas**: cada uno es el resultado
 * corregido de una conversación real, con los alimentos y las porciones que la
 * persona confirmó. Sirven de referencia sin tener que etiquetar nada nuevo.
 *
 *   npm run eval -- --texto                 # entrada: los nombres de los ítems
 *   npm run eval -- --fotos ./fotos-eval    # entrada: las fotos originales
 *   npm run eval -- --texto --limite 10     # solo las primeras 10 comidas
 *
 * Usa el mismo `estimar()` y la misma normalización que la app en producción:
 * medir una copia parecida no mediría nada.
 *
 * Requiere ANTHROPIC_API_KEY. Es la única parte del proyecto que gasta dinero,
 * así que primero estima el costo y pide confirmación.
 */
import { createInterface } from "node:readline/promises";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { config as cargarEnv } from "dotenv";
import type { Alimento } from "@/lib/alimentos";
import { encontrar, mediana } from "@/lib/evaluacion";
import { estimar } from "@/lib/vision/cliente";
import { normalizarEstimacion } from "@/lib/vision/normalizar";
import { slugificar } from "@/lib/importacion/mapeo";

cargarEnv({ path: ".env.local", quiet: true });

// ------------------------------------------------------------ argumentos ---

const args = process.argv.slice(2);
const usarFotos = args.includes("--fotos");
/** Lee y prepara todo sin llamar a la API: para probar el script sin gastar. */
const dry = args.includes("--dry");
const dirFotos = usarFotos ? args[args.indexOf("--fotos") + 1] : null;
const limite = args.includes("--limite")
  ? Number(args[args.indexOf("--limite") + 1])
  : Infinity;
const repo =
  (args.includes("--repo") ? args[args.indexOf("--repo") + 1] : null) ??
  process.env.FITFOOD_REPO_PATH ??
  "../fitfood";

if (!usarFotos && !args.includes("--texto")) {
  console.error(
    "Falta el modo. Usá --texto (los nombres de los ítems) o --fotos <carpeta>.",
  );
  process.exit(1);
}

// ------------------------------------------------------------ etiquetas ---

interface ItemEtiqueta {
  alimento: string;
  porcion_g?: number;
  porcion_ml?: number;
  kcal: number;
}

interface ComidaEtiqueta {
  fecha: string;
  momento: string;
  items: ItemEtiqueta[];
  kcalReal: number;
}

async function leerEtiquetas(): Promise<ComidaEtiqueta[]> {
  const dir = path.join(repo, "data", "comidas");
  const archivos = (await readdir(dir))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const comidas: ComidaEtiqueta[] = [];
  for (const archivo of archivos) {
    const dia = JSON.parse(await readFile(path.join(dir, archivo), "utf8"));
    if (typeof dia.dia_plan !== "number") continue; // el pre-plan no cuenta

    for (const comida of dia.comidas) {
      comidas.push({
        fecha: dia.fecha,
        momento: comida.momento,
        items: comida.items,
        kcalReal: comida.subtotal.kcal,
      });
    }
  }
  return comidas;
}

async function leerTabla(): Promise<Alimento[]> {
  const ruta = path.join(repo, "data", "tabla_alimentos.json");
  const datos = JSON.parse(await readFile(ruta, "utf8"));
  return datos.alimentos.map((a: Record<string, never>) => ({
    id: slugificar(a.nombre),
    slug: slugificar(a.nombre),
    nombre: a.nombre,
    categoria: a.categoria,
    kcal100: a.kcal100,
    p100: a.p100,
    c100: a.c100,
    g100: a.g100,
    porcionG: a.porcion_g ?? null,
    porcionNota: a.porcion_nota ?? null,
  }));
}

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${((n / total) * 100).toFixed(0)} %`;
}

// ------------------------------------------------------------------ main ---

async function main() {
  if (!dry && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "✗ Falta ANTHROPIC_API_KEY. Es la única parte del proyecto que llama a\n" +
        "  la API de verdad, así que sin clave no hay nada que medir.",
    );
    process.exit(1);
  }

  const [etiquetas, tabla] = await Promise.all([leerEtiquetas(), leerTabla()]);
  const aMedir = etiquetas.slice(0, limite);

  if (usarFotos && (!dirFotos || !existsSync(dirFotos))) {
    console.error(`✗ No existe la carpeta de fotos: ${dirFotos}`);
    process.exit(1);
  }

  // Una estimación gruesa, para que nadie arranque sin saber qué va a gastar.
  const costoAprox = aMedir.length * (usarFotos ? 0.035 : 0.02);
  console.log(
    `\nSe van a medir ${aMedir.length} comidas en modo ${usarFotos ? "foto" : "texto"}.\n` +
      `Costo aproximado: $${costoAprox.toFixed(2)} USD.\n`,
  );

  if (dry) {
    console.log(
      `Modo --dry: no se llama a la API.\n\n` +
        `  Alimentos en la tabla   ${tabla.length}\n` +
        `  Comidas etiquetadas     ${etiquetas.length}\n` +
        `  Ítems a comparar        ${aMedir.reduce((n, c) => n + c.items.length, 0)}\n` +
        `  Primera comida          ${aMedir[0]?.fecha} ${aMedir[0]?.momento}\n` +
        `    entrada               "${aMedir[0]?.items.map((i) => i.alimento).join(", ").slice(0, 90)}…"\n` +
        `    referencia            ${Math.round(aMedir[0]?.kcalReal ?? 0)} kcal\n`,
    );
    return;
  }

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await rl.question("¿Seguimos? [s/N] ");
    rl.close();
    if (!/^s/i.test(respuesta.trim())) {
      console.log("Cancelado.");
      return;
    }
  }

  let itemsEsperados = 0;
  let aciertosEstrictos = 0;
  let aciertosLaxos = 0;
  const erroresKcal: number[] = [];
  const erroresPorcion: number[] = [];
  const latencias: number[] = [];
  let costoReal = 0;
  let fallos = 0;

  for (const [i, comida] of aMedir.entries()) {
    const nombres = comida.items.map((it) => it.alimento).join(", ");
    process.stdout.write(
      `[${i + 1}/${aMedir.length}] ${comida.fecha} ${comida.momento}… `,
    );

    let fotoBase64: string | null = null;
    if (usarFotos) {
      const ruta = path.join(dirFotos!, `${comida.fecha}-${comida.momento}.jpg`);
      if (!existsSync(ruta)) {
        console.log("sin foto, se salta");
        continue;
      }
      fotoBase64 = (await readFile(ruta)).toString("base64");
    }

    try {
      const resultado = await estimar({
        alimentos: tabla,
        // En modo texto la entrada son los nombres, sin porciones ni macros:
        // adivinar la cantidad es justamente lo que se está midiendo.
        texto: usarFotos ? null : nombres,
        fotoBase64,
        fotoMediaType: fotoBase64 ? "image/jpeg" : null,
        previos: [],
        objetivo: null,
        consumidoHoy: null,
        alimentosFrecuentes: [],
      });

      costoReal += resultado.costoUsd;
      latencias.push(resultado.latenciaMs);

      const { items } = normalizarEstimacion(resultado.respuesta.items, tabla);

      for (const esperado of comida.items) {
        itemsEsperados++;
        const { estricto, laxo } = encontrar(esperado.alimento, items);
        if (estricto) aciertosEstrictos++;
        if (laxo !== null) {
          aciertosLaxos++;
          const gEsperado = esperado.porcion_g ?? esperado.porcion_ml;
          const gEstimado = items[laxo].porcionG ?? items[laxo].porcionMl;
          if (gEsperado && gEstimado) {
            erroresPorcion.push(Math.abs(gEstimado - gEsperado) / gEsperado);
          }
        }
      }

      const kcalEstimado = items.reduce((n, it) => n + it.kcal, 0);
      const error = Math.abs(kcalEstimado - comida.kcalReal) / comida.kcalReal;
      erroresKcal.push(error);

      console.log(
        `${Math.round(kcalEstimado)} vs ${Math.round(comida.kcalReal)} kcal ` +
          `(${(error * 100).toFixed(0)} %)`,
      );
    } catch (err) {
      fallos++;
      console.log(`falló: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  // ------------------------------------------------------------ informe ---

  const medKcal = mediana(erroresKcal);
  const medPorcion = mediana(erroresPorcion);
  const bajo20 = erroresKcal.filter((e) => e < 0.2).length;

  console.log(`
────────────────────────────────────────────
  RESULTADO — modo ${usarFotos ? "foto" : "texto"}, ${erroresKcal.length} comidas

  Alimentos identificados
    estricto (mismo nombre)   ${pct(aciertosEstrictos, itemsEsperados)}  (${aciertosEstrictos}/${itemsEsperados})
    laxo (mismo alimento)     ${pct(aciertosLaxos, itemsEsperados)}  (${aciertosLaxos}/${itemsEsperados})

  Error calórico por comida
    mediana                   ${medKcal === null ? "—" : `${(medKcal * 100).toFixed(0)} %`}
    comidas bajo el 20 %      ${pct(bajo20, erroresKcal.length)}

  Error de porción
    mediana                   ${medPorcion === null ? "—" : `${(medPorcion * 100).toFixed(0)} %`}

  Latencia mediana            ${mediana(latencias)?.toFixed(0) ?? "—"} ms
  Costo real                  $${costoReal.toFixed(3)} USD${fallos > 0 ? `\n  Fallos                      ${fallos}` : ""}

  Objetivo del plan: >70 % de alimentos acertados y <20 % de error calórico.
────────────────────────────────────────────
`);
}

main().catch((err) => {
  console.error("\n✗ La evaluación falló:", err.message ?? err);
  process.exit(1);
});
