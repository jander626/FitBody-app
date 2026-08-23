import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { claveAnonima, urlSupabase } from "./entorno";
import type { Database } from "./tipos-db";

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 *
 * Hay que crear uno nuevo por request: compartirlo entre requests mezclaría
 * sesiones de personas distintas.
 *
 * En Next.js 16 `cookies()` es asíncrono — el acceso síncrono se eliminó.
 */
export async function clienteServidor() {
  const almacen = await cookies();

  return createServerClient<Database>(urlSupabase(), claveAnonima(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(aEscribir) {
        try {
          for (const { name, value, options } of aEscribir) {
            almacen.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. No es un
          // problema: proxy.ts refresca la sesión antes de renderizar, así
          // que acá no queda nada pendiente por escribir.
        }
      },
    },
  });
}

/**
 * Devuelve el usuario autenticado, o null.
 *
 * Usa `getUser()` y no `getSession()` a propósito: getSession lee la cookie
 * sin validarla contra el servidor de auth, así que un token manipulado
 * pasaría. Para decidir qué datos mostrar, eso no alcanza.
 */
export async function usuarioActual() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
