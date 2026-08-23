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

/**
 * Claves foráneas, para poblar `Relationships`. No es decorativo: postgrest-js
 * lo exige en cada tabla (sin él, todo el `Database` colapsa a `never` y las
 * consultas dejan de tipar), y además habilita el tipado de los joins.
 */
const CONSULTA_FKS = `
select coalesce(json_agg(t), '[]'::json) from (
  select
    con.conname                as nombre,
    orig.relname               as tabla,
    array_agg(ac.attname order by u.ord)      as columnas,
    dest.relname               as tabla_destino,
    array_agg(bc.attname order by u.ord)      as columnas_destino,
    con.conkey                 as claves
  from pg_constraint con
  join pg_class orig on orig.oid = con.conrelid
  join pg_class dest on dest.oid = con.confrelid
  join pg_namespace n on n.oid = orig.relnamespace
  join unnest(con.conkey) with ordinality as u(attnum, ord) on true
  join pg_attribute ac on ac.attrelid = con.conrelid  and ac.attnum = u.attnum
  join unnest(con.confkey) with ordinality as w(attnum, ord) on w.ord = u.ord
  join pg_attribute bc on bc.attrelid = con.confrelid and bc.attnum = w.attnum
  where con.contype = 'f' and n.nspname = 'public'
  group by con.conname, orig.relname, dest.relname, con.conkey
) t;
`;

interface Columna {
  tabla: string;
  columna: string;
  tipo: string;
  anulable: boolean;
  tiene_default: boolean;
}

interface ClaveForanea {
  nombre: string;
  tabla: string;
  columnas: string[];
  tabla_destino: string;
  columnas_destino: string[];
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

function consultar<T>(sql: string): T {
  const salida = execFileSync(
    "psql",
    ["-tAc", sql, process.env.PGDATABASE ?? "fitfood_types"],
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
  return JSON.parse(salida) as T;
}

/** psql serializa los array de Postgres como "{a,b}". */
function aLista(valor: string[] | string): string[] {
  if (Array.isArray(valor)) return valor;
  return valor.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
}

function generar(columnas: Columna[], fks: ClaveForanea[]): string {
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

      const relaciones = fks
        .filter((fk) => fk.tabla === tabla)
        .map((fk) => {
          const cols = aLista(fk.columnas);
          const dest = aLista(fk.columnas_destino);
          return `          {
            foreignKeyName: ${JSON.stringify(fk.nombre)};
            columns: [${cols.map((c) => JSON.stringify(c)).join(", ")}];
            isOneToOne: false;
            referencedRelation: ${JSON.stringify(fk.tabla_destino)};
            referencedColumns: [${dest.map((c) => JSON.stringify(c)).join(", ")}];
          },`;
        })
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
        Relationships: [${relaciones ? `\n${relaciones}\n        ` : ""}];
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

const columnas = consultar<Columna[]>(CONSULTA);
const fks = consultar<ClaveForanea[]>(CONSULTA_FKS);
writeFileSync(SALIDA, generar(columnas, fks));
const tablas = new Set(columnas.map((c) => c.tabla)).size;
console.log(`✓ ${path.relative(RAIZ, SALIDA)} — ${tablas} tablas, ${columnas.length} columnas`);
