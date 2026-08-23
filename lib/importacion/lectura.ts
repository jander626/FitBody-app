/**
 * Lee la bitácora y devuelve filas listas para el esquema.
 *
 * Separado del script que escribe en Supabase para que la verificación pueda
 * usar exactamente este código contra un Postgres desechable. Probar una
 * segunda implementación "equivalente" no probaría nada.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  aConfianza,
  aMomento,
  interpretarOrigen,
  normalizar,
  notaDeItem,
  slugificar,
  type Confianza,
  type Momento,
  type Origen,
} from "./mapeo";

// ------------------------------------------------ forma de los archivos ---

interface AlimentoTabla {
  nombre: string;
  categoria: string;
  kcal100: number;
  p100: number;
  c100: number;
  g100: number;
  porcion_g?: number;
  porcion_nota?: string;
}

interface ItemComida {
  alimento: string;
  porcion_g?: number;
  porcion_ml?: number;
  kcal: number;
  proteina_g: number;
  carbs_g: number;
  grasa_g: number;
  nota_correccion?: string;
  nota?: string;
  nota_porcion?: string;
  porcion_nota?: string;
}

interface ComidaArchivo {
  momento: string;
  hora?: string;
  items: ItemComida[];
  confianza?: string;
  origen?: string;
  nota?: string;
  subtotal: { kcal: number };
}

interface DiaArchivo {
  fecha: string;
  dia_plan?: number;
  comidas: ComidaArchivo[];
  totales: { kcal: number };
}

interface PerfilArchivo {
  basicos: {
    edad: number;
    sexo: string;
    estatura_cm: number;
    peso_meta_kg: number;
  };
  calculado: {
    factor_actividad: number;
    deficit_pct: number;
    kcal_objetivo: number;
    proteina_g: number;
    carbohidratos_g: number;
    grasa_g: number;
  };
  fechas: { dia_1: string };
}

interface PesosArchivo {
  registros: {
    fecha: string;
    kg: number;
    condiciones?: string;
    nota?: string;
  }[];
}

// ------------------------------------------------------- filas de salida ---

export interface FilaFood {
  slug: string;
  nombre: string;
  categoria: string;
  kcal100: number;
  p100: number;
  c100: number;
  g100: number;
  porcion_g: number | null;
  porcion_nota: string | null;
}

export interface FilaPerfil {
  edad: number;
  sexo: "hombre" | "mujer";
  estatura_cm: number;
  fecha_dia_1: string;
}

export interface FilaObjetivo {
  objetivo: "perder_grasa";
  peso_meta_kg: number;
  factor_actividad: number;
  deficit_pct: number;
  kcal: number;
  proteina_g: number;
  carbs_g: number;
  grasa_g: number;
}

export interface FilaPeso {
  fecha: string;
  peso_kg: number;
  condiciones: string | null;
  nota: string | null;
}

export interface FilaItem {
  /** Nombre normalizado del alimento, para resolver food_id más tarde. */
  clave_alimento: string;
  alimento: string;
  porcion_g: number | null;
  porcion_ml: number | null;
  kcal: number;
  proteina_g: number;
  carbs_g: number;
  grasa_g: number;
  nota_correccion: string | null;
  nota: string | null;
  orden: number;
}

export interface FilaComida {
  fecha: string;
  momento: Momento;
  hora: string | null;
  confianza: Confianza | null;
  origen: Origen;
  corregido: boolean;
  nota: string | null;
  items: FilaItem[];
  /** Subtotal declarado en la bitácora, para poder contrastarlo. */
  subtotal_kcal: number;
}

export interface FilaDia {
  fecha: string;
  dia_plan: number;
  comidas: FilaComida[];
  total_kcal: number;
}

export interface Bitacora {
  foods: FilaFood[];
  perfil: FilaPerfil;
  objetivo: FilaObjetivo;
  pesos: FilaPeso[];
  dias: FilaDia[];
  /** Días sin `dia_plan`, es decir el pre-plan que se descarta. */
  diasSalteados: number;
}

// ------------------------------------------------------------- lectura ---

async function leerJson<T>(repo: string, ...partes: string[]): Promise<T> {
  const ruta = path.join(repo, ...partes);
  try {
    return JSON.parse(await readFile(ruta, "utf8")) as T;
  } catch (err) {
    throw new Error(
      `No se pudo leer ${ruta}. ¿La ruta apunta a un clon de ` +
        `jander626/fitfood? (${(err as Error).message})`,
    );
  }
}

export async function leerBitacora(repo: string): Promise<Bitacora> {
  // --- alimentos ---
  const tabla = await leerJson<{ alimentos: AlimentoTabla[] }>(
    repo,
    "data",
    "tabla_alimentos.json",
  );

  const foods: FilaFood[] = tabla.alimentos.map((a) => ({
    slug: slugificar(a.nombre),
    nombre: a.nombre,
    categoria: a.categoria,
    kcal100: a.kcal100,
    p100: a.p100,
    c100: a.c100,
    g100: a.g100,
    porcion_g: a.porcion_g ?? null,
    porcion_nota: a.porcion_nota ?? null,
  }));

  const vistos = new Set<string>();
  for (const f of foods) {
    if (vistos.has(f.slug)) {
      throw new Error(
        `Dos alimentos generan el mismo slug "${f.slug}". Hay que ` +
          `desambiguarlos en tabla_alimentos.json antes de importar.`,
      );
    }
    vistos.add(f.slug);
  }

  // --- perfil y objetivo ---
  const p = await leerJson<PerfilArchivo>(repo, "data", "perfil.json");

  const perfil: FilaPerfil = {
    edad: p.basicos.edad,
    sexo: p.basicos.sexo === "hombre" ? "hombre" : "mujer",
    estatura_cm: p.basicos.estatura_cm,
    fecha_dia_1: p.fechas.dia_1,
  };

  const objetivo: FilaObjetivo = {
    objetivo: "perder_grasa",
    peso_meta_kg: p.basicos.peso_meta_kg,
    factor_actividad: p.calculado.factor_actividad,
    deficit_pct: p.calculado.deficit_pct,
    kcal: p.calculado.kcal_objetivo,
    proteina_g: p.calculado.proteina_g,
    carbs_g: p.calculado.carbohidratos_g,
    grasa_g: p.calculado.grasa_g,
  };

  // --- pesos ---
  const pesosArchivo = await leerJson<PesosArchivo>(repo, "data", "peso.json");
  const pesos: FilaPeso[] = pesosArchivo.registros.map((r) => ({
    fecha: r.fecha,
    peso_kg: r.kg,
    condiciones: r.condiciones ?? null,
    nota: r.nota ?? null,
  }));

  // --- comidas ---
  const dirComidas = path.join(repo, "data", "comidas");
  const archivos = (await readdir(dirComidas))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const dias: FilaDia[] = [];
  let diasSalteados = 0;

  for (const archivo of archivos) {
    const dia = await leerJson<DiaArchivo>(repo, "data", "comidas", archivo);

    // El pre-plan (11 ago) no tiene dia_plan y no cuenta, igual que en
    // scripts/build_dashboard_data.py de la bitácora.
    if (typeof dia.dia_plan !== "number") {
      diasSalteados++;
      continue;
    }

    dias.push({
      fecha: dia.fecha,
      dia_plan: dia.dia_plan,
      total_kcal: dia.totales.kcal,
      comidas: dia.comidas.map((c) => {
        const { origen, corregido } = interpretarOrigen(c.origen);
        return {
          fecha: dia.fecha,
          momento: aMomento(c.momento),
          hora: c.hora ?? null,
          confianza: aConfianza(c.confianza),
          origen,
          corregido,
          nota: c.nota ?? null,
          subtotal_kcal: c.subtotal.kcal,
          items: c.items.map((item, orden) => ({
            clave_alimento: normalizar(item.alimento),
            alimento: item.alimento,
            porcion_g: item.porcion_g ?? null,
            porcion_ml: item.porcion_ml ?? null,
            kcal: item.kcal,
            proteina_g: item.proteina_g,
            carbs_g: item.carbs_g,
            grasa_g: item.grasa_g,
            nota_correccion: item.nota_correccion ?? null,
            nota: notaDeItem(item),
            orden,
          })),
        };
      }),
    });
  }

  return { foods, perfil, objetivo, pesos, dias, diasSalteados };
}
