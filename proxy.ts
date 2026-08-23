/**
 * Refresco de sesión y guardia de rutas.
 *
 * En Next.js 16 este archivo se llama `proxy.ts` (antes `middleware.ts`) y
 * corre siempre en runtime nodejs, lo que le viene bien al SSR de Supabase.
 *
 * Corre antes de renderizar cualquier página: acá se renueva el token de
 * acceso y se escriben las cookies actualizadas. Los Server Components no
 * pueden escribir cookies, así que si esto no estuviera, la sesión se caería
 * sola cada hora y de formas difíciles de depurar.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas accesibles sin sesión. Todo lo demás exige estar dentro. */
const PUBLICAS = ["/login", "/auth", "/offline"];

function esPublica(pathname: string): boolean {
  return PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin configuración no se puede validar nada. Antes que fingir que todo el
  // mundo está autenticado, se manda a /login, que explica qué falta.
  if (!url || !clave) {
    if (esPublica(request.nextUrl.pathname)) return respuesta;
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(aEscribir, cabeceras) {
        for (const { name, value } of aEscribir) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of aEscribir) {
          respuesta.cookies.set(name, value, options);
        }
        // Las cabeceras que manda la librería impiden que un CDN cachee una
        // respuesta con Set-Cookie. Omitirlas puede servirle la sesión de una
        // persona a otra, así que no son opcionales.
        for (const [clave, valor] of Object.entries(cabeceras)) {
          respuesta.headers.set(clave, valor);
        }
      },
    },
  });

  // getUser() valida el token contra el servidor de auth. No reemplazar por
  // getSession(), que solo lee la cookie y da por buena cualquier firma.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !esPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    // Para volver a donde iba después de entrar.
    destino.searchParams.set("siguiente", pathname);
    return NextResponse.redirect(destino);
  }

  if (user && pathname === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/hoy";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todo menos estáticos y el service worker. Sin este negativo, el proxy
     * correría sobre cada CSS, JS e icono, y la redirección a /login
     * rompería la carga de la propia página de login.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest).*)",
  ],
};
