/**
 * Un Supabase de mentira, lo justo para probar el endpoint de registro.
 *
 * Cada método del constructor de consultas devuelve el mismo objeto, que
 * además es "thenable": así soporta tanto `.eq().gte()` encadenado como el
 * `await` final, sin implementar Postgrest de verdad.
 */

export interface RespuestaTabla {
  data?: unknown;
  count?: number;
  error?: { message: string } | null;
}

export interface ConfigFalsa {
  /** Resultado por tabla. Se puede dar una función para variar por llamada. */
  tablas: Record<string, RespuestaTabla | (() => RespuestaTabla)>;
  usuario?: { id: string } | null;
}

export interface SupabaseFalso {
  cliente: unknown;
  /** Registro de las tablas consultadas, en orden. */
  llamadas: string[];
  /** Filas insertadas por tabla. */
  insertados: Record<string, unknown[]>;
}

export function crearSupabaseFalso(config: ConfigFalsa): SupabaseFalso {
  const llamadas: string[] = [];
  const insertados: Record<string, unknown[]> = {};

  function constructor(tabla: string) {
    const resolver = (): RespuestaTabla => {
      const entrada = config.tablas[tabla];
      const base =
        typeof entrada === "function" ? entrada() : (entrada ?? { data: [] });
      return { error: null, ...base };
    };

    const cadena: Record<string, unknown> = {};
    const metodos = [
      "select",
      "eq",
      "gte",
      "lte",
      "order",
      "limit",
      "update",
      "delete",
      "upsert",
    ];

    for (const metodo of metodos) {
      cadena[metodo] = () => cadena;
    }

    cadena.insert = (filas: unknown) => {
      insertados[tabla] ??= [];
      insertados[tabla].push(filas);
      return cadena;
    };
    cadena.single = () => Promise.resolve(resolver());
    cadena.maybeSingle = () => Promise.resolve(resolver());
    // Thenable: permite `await db.from("x").select().eq()`.
    cadena.then = (
      alCumplir: (valor: RespuestaTabla) => unknown,
      alFallar?: (razon: unknown) => unknown,
    ) => Promise.resolve(resolver()).then(alCumplir, alFallar);

    return cadena;
  }

  const cliente = {
    from(tabla: string) {
      llamadas.push(tabla);
      return constructor(tabla);
    },
    auth: {
      getUser: async () => ({
        data: { user: config.usuario === undefined ? { id: "u1" } : config.usuario },
      }),
    },
  };

  return { cliente, llamadas, insertados };
}
