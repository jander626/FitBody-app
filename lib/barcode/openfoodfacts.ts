/**
 * Código de barras → producto con sus valores por 100 g.
 *
 * Open Food Facts es colaborativa: un producto puede existir sin nutrientes,
 * con las kcal en kJ, o con un nombre vacío. Este módulo decide qué se acepta
 * y qué no, y nunca inventa un número: si falta algo que hace falta para
 * calcular macros, devuelve `sin_nutricion` y la pantalla manda a registrar
 * por foto o texto.
 *
 * Módulo puro. La llamada de red vive en `app/api/codigo-barras`.
 */

export interface ProductoEscaneado {
  codigo: string;
  nombre: string;
  marca: string | null;
  kcal100: number;
  p100: number;
  c100: number;
  g100: number;
  /** Tamaño de una porción en gramos o ml, si el producto lo declara. */
  porcionG: number | null;
}

export type ResultadoProducto =
  | { estado: "ok"; producto: ProductoEscaneado }
  | { estado: "no_encontrado" }
  | { estado: "sin_nutricion"; nombre: string | null };

const KJ_POR_KCAL = 4.184;

/** EAN-8, UPC-A (12), EAN-13 y GTIN-14. */
export function esCodigoValido(codigo: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(codigo);
}

function numero(valor: unknown): number | null {
  const n = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Interpreta la respuesta de `/api/v2/product/{codigo}.json` de Open Food Facts. */
export function parsearProducto(codigo: string, json: unknown): ResultadoProducto {
  const raiz = json as { status?: unknown; product?: Record<string, unknown> } | null;
  if (!raiz || raiz.status !== 1 || !raiz.product) return { estado: "no_encontrado" };

  const p = raiz.product;
  const nombre =
    texto(p.product_name_es) ?? texto(p.product_name) ?? texto(p.generic_name_es);
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  const proteina = numero(n["proteins_100g"]);
  const carbs = numero(n["carbohydrates_100g"]);
  const grasa = numero(n["fat_100g"]);

  let kcal = numero(n["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = numero(n["energy-kj_100g"]) ?? numero(n["energy_100g"]);
    if (kj !== null) kcal = kj / KJ_POR_KCAL;
  }

  // Sin las cuatro cifras no hay forma honesta de calcular una porción.
  if (kcal === null || proteina === null || carbs === null || grasa === null) {
    return { estado: "sin_nutricion", nombre };
  }
  if (!nombre) return { estado: "sin_nutricion", nombre: null };

  const porcion = numero(p.serving_quantity);

  return {
    estado: "ok",
    producto: {
      codigo,
      nombre,
      marca: texto(p.brands)?.split(",")[0].trim() ?? null,
      kcal100: Math.round(kcal),
      p100: r1(proteina),
      c100: r1(carbs),
      g100: r1(grasa),
      porcionG: porcion !== null && porcion > 0 && porcion <= 2000 ? porcion : null,
    },
  };
}
