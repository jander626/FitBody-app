/**
 * Genera lib/supabase/tipos-db.ts a partir del catálogo de un Postgres que ya
 * tenga las migraciones aplicadas.
 *
 * La CLI de Supabase hace esto, pero exige Docker. Esto solo necesita `psql`,
 * así que corre igual en un contenedor pelado y en CI.
 *
 *   ./scripts/verificar-migraciones.sh --dejar-vivo   # levanta la base
 *   PGPORT=5434 npx tsx scripts/gen-tipos-db.ts
 *
 * Se versiona la salida: el build nunca depende de tener una base a mano.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SALIDA = path.join(RAIZ, "lib", "supabase", "tipos-db.ts");

const CONSULTA = `
select json_agg(t order by t.tabla, t.posicion) from (
  select
    c.table_name  as tabla,
    c.ordinal_position as posicion,
    c.column_name as columna,
    c.udt_name    as tipo,
    c.is_nullable = 'YES' as anulable,
    (c.column_default is not null or c.is_identity = 'YES') as tiene_default
  from information_schema.columns c
  join information_schema.tables tb
    on tb.table_schema = c.table_schema and tb.table_name = c.table_name
  where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
) t;
`;

interface Columna {
  tabla: string;
  columna: string;
  tipo: string;
  anulable: boolean;
  tiene_default: boolean;
}

/** Mapea tipos de Postgres a TypeScript. Lo que no reconoce, lo dice. */
function aTipoTS(pg: string): string {
  if (pg.startsWith("_")) return `${aTipoTS(pg.slice(1))}[]`;
  switch (pg) {
    case "uuid":
    case "text":
    case "varchar":
    case "date":
    case "time":
    case "timetz":
    case "timestamp":
    case "timestamptz":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "numeric":
    case "float4":
    case "float8":
      return "number";
    case "bool":
      return "boolean";
    case "json":
    case "jsonb":
      return "Json";
    default:
      throw new Error(
        `Tipo de Postgres sin mapear: "${pg}". Agrégalo a aTipoTS() en ` +
          `scripts/gen-tipos-db.ts en vez de dejar que caiga en any.`,
      );
  }
}

function consultar(): Columna[] {
  const salida = execFileSync(
    "psql",
    ["-tAc", CONSULTA, process.env.PGDATABASE ?? "fitfood_types"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PGHOST: process.env.PGHOST ?? "127.0.0.1",
        PGPORT: process.env.PGPORT ?? "5434",
        PGUSER: process.env.PGUSER ?? "postgres",
      },
    },
  ).trim();

  if (!salida) throw new Error("El catálogo vino vacío: ¿aplicaste las migraciones?");
  return JSON.parse(salida) as Columna[];
}

function generar(columnas: Columna[]): string {
  const porTabla = new Map<string, Columna[]>();
  for (const col of columnas) {
    const lista = porTabla.get(col.tabla) ?? [];
    lista.push(col);
    porTabla.set(col.tabla, lista);
  }

  const bloques = [...porTabla.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tabla, cols]) => {
      const fila = cols
        .map((c) => `          ${c.columna}: ${aTipoTS(c.tipo)}${c.anulable ? " | null" : ""};`)
        .join("\n");

      // En Insert es opcional lo que tenga default o admita null.
      const insert = cols
        .map((c) => {
          const opcional = c.tiene_default || c.anulable;
          return `          ${c.columna}${opcional ? "?" : ""}: ${aTipoTS(c.tipo)}${
            c.anulable ? " | null" : ""
          };`;
        })
        .join("\n");

      const update = cols
        .map(
          (c) =>
            `          ${c.columna}?: ${aTipoTS(c.tipo)}${c.anulable ? " | null" : ""};`,
        )
        .join("\n");

      return `      ${tabla}: {
        Row: {
${fila}
        };
        Insert: {
${insert}
        };
        Update: {
${update}
        };
      };`;
    })
    .join("\n");

  return `// GENERADO POR scripts/gen-tipos-db.ts — no editar a mano.
// Para regenerar, ver el encabezado de ese script.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
${bloques}
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
`;
}

const columnas = consultar();
writeFileSync(SALIDA, generar(columnas));
const tablas = new Set(columnas.map((c) => c.tabla)).size;
console.log(`✓ ${path.relative(RAIZ, SALIDA)} — ${tablas} tablas, ${columnas.length} columnas`);
