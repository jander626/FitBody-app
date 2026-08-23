/**
 * Lectura de configuración con un error útil cuando falta algo.
 *
 * Sin esto, olvidar una variable se manifiesta como un "fetch failed" opaco a
 * mitad de una consulta. Mejor fallar temprano y decir exactamente qué falta.
 */

function exigir(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        `Copiá .env.example a .env.local y llenala (ver el README).`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return exigir(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function claveAnonima(): string {
  return exigir(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Clave de servicio: salta RLS por completo.
 *
 * Solo para scripts locales (la importación). Si esto termina llegando al
 * navegador, cualquiera puede leer los datos de cualquiera — por eso no lleva
 * el prefijo NEXT_PUBLIC_ y por eso vive en su propia función, para que sea
 * visible en un grep quién la usa.
 */
export function claveDeServicio(): string {
  return exigir(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
