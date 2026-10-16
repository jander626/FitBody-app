/**
 * Canje del magic link por una sesión.
 *
 * Supabase manda a esta ruta con un `code` de un solo uso. Acá se cambia por
 * cookies de sesión y se redirige a donde la persona iba.
 */
import { NextResponse, type NextRequest } from "next/server";
import { aplicarEntrada } from "@/lib/datos/aplicar-entrada";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const siguiente = searchParams.get("siguiente") ?? "/hoy";

  // Solo rutas internas: sin esto, un enlace con `siguiente=https://otro.sitio`
  // convertiría el login en un redirector abierto.
  const destino = siguiente.startsWith("/") && !siguiente.startsWith("//")
    ? siguiente
    : "/hoy";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=sin_codigo`);
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
  }

  // Si la persona venía del flujo de entrada, su plan se crea ahora. Un
  // fallo acá no puede impedir el acceso: ver `aplicarEntrada`.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await aplicarEntrada(supabase, user);

  return NextResponse.redirect(`${origin}${destino}`);
}
