"use client";

import { createBrowserClient } from "@supabase/ssr";
import { claveAnonima, urlSupabase } from "./entorno";
import type { Database } from "./tipos-db";

/**
 * Cliente para componentes del navegador.
 *
 * `createBrowserClient` ya devuelve un singleton, así que llamarlo en cada
 * componente no crea conexiones de más.
 */
export function clienteNavegador() {
  return createBrowserClient<Database>(urlSupabase(), claveAnonima());
}
