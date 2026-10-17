import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
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
 * Usa `getClaims()` y no `getSession()` a propósito: getSession lee la cookie y
 * da por buena cualquier firma, y para decidir qué datos mostrar eso no
 * alcanza. `getClaims()` sí verifica la firma del token. Con las llaves de
 * firma asimétricas de Supabase lo hace en el propio servidor, sin ir a
 * preguntarle al servicio de auth; sin ellas, cae a preguntarle, igual que
 * `getUser()`. O sea: nunca peor, y a menudo un viaje de red menos.
 *
 * Va envuelta en `cache` de React: el layout y la página lo piden en la misma
 * petición, y sin esto cada uno hacía su propia verificación. Solo devuelve
 * el id porque es lo único que usan quienes la llaman; las escrituras siguen
 * validando con `getUser()` contra el servidor.
 */
export const usuarioActual = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { id } : null;
});
