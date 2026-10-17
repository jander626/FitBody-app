/**
 * Busca un producto por código de barras en Open Food Facts.
 *
 * Va por el servidor y no desde el navegador por dos razones: Open Food Facts
 * pide un User-Agent propio, y así la app decide qué campos se aceptan en vez
 * de confiar en lo que devuelva un tercero. Exige sesión para que no sirva de
 * proxy abierto.
 */
import { NextResponse, type NextRequest } from "next/server";
import { esCodigoValido, parsearProducto } from "@/lib/barcode/openfoodfacts";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

const CAMPOS = [
  "product_name",
  "product_name_es",
  "generic_name_es",
  "brands",
  "nutriments",
  "serving_quantity",
].join(",");

export async function GET(request: NextRequest) {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión vencida. Entrá de nuevo." }, { status: 401 });
  }

  const codigo = request.nextUrl.searchParams.get("codigo")?.trim() ?? "";
  if (!esCodigoValido(codigo)) {
    return NextResponse.json({ error: "Ese código no es válido." }, { status: 400 });
  }

  // Primero lo propio: un producto que ya se guardó sale al instante, sin red y
  // sin depender de que Open Food Facts lo tenga. El RLS ya limita la consulta
  // a los alimentos de esta persona.
  const { data: propio } = await supabase
    .from("foods")
    .select("id, nombre, kcal100, p100, c100, g100, porcion_g")
    .eq("codigo_barras", codigo)
    .eq("creado_por", user.id)
    .maybeSingle();

  if (propio) {
    return NextResponse.json({
      estado: "ok",
      origen: "propio",
      producto: {
        codigo,
        nombre: propio.nombre,
        marca: null,
        kcal100: Number(propio.kcal100),
        p100: Number(propio.p100),
        c100: Number(propio.c100),
        g100: Number(propio.g100),
        porcionG: propio.porcion_g === null ? null : Number(propio.porcion_g),
        foodId: propio.id,
      },
    });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=${CAMPOS}`,
      {
        headers: { "User-Agent": "FitFood/1.0 (app personal de registro de comidas)" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar la base de productos. Probá de nuevo." },
      { status: 502 },
    );
  }

  // Open Food Facts contesta 404 con cuerpo JSON cuando el código no existe.
  if (respuesta.status !== 200 && respuesta.status !== 404) {
    return NextResponse.json(
      { error: "La base de productos no respondió bien. Probá de nuevo." },
      { status: 502 },
    );
  }

  const json: unknown = await respuesta.json().catch(() => null);
  return NextResponse.json(parsearProducto(codigo, json));
}
