/**
 * Lee la tabla nutricional de una foto.
 *
 * Es el segundo endpoint que habla con un modelo, y sigue la misma regla que el
 * de registro: primero el techo de gasto contra Postgres, después la llamada. Si
 * el límite rechaza, el modelo no se toca.
 *
 * No guarda el producto: devuelve lo leído para que la persona lo mire y lo
 * corrija. Un modelo puede equivocarse en un dígito, y una etiqueta mal leída
 * que se guarda sola contamina cada comida futura con ese producto.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sanearLectura } from "@/lib/barcode/etiqueta";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { leerEtiqueta } from "@/lib/vision/cliente";

/** Lecturas por persona y por día. Una etiqueta es una foto; veinte sobran. */
const LECTURAS_POR_DIA = 20;

const PeticionSchema = z.object({
  /** JPEG en base64, sin el prefijo `data:`. Una etiqueta a 1800 px pesa ~400 KB. */
  fotoBase64: z.string().min(100).max(6_000_000),
  fotoMediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export async function POST(request: NextRequest) {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión vencida. Entra de nuevo." }, { status: 401 });
  }

  let cuerpo: z.infer<typeof PeticionSchema>;
  try {
    cuerpo = PeticionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  // --- el techo, antes de gastar un centavo ---
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: errConteo } = await supabase
    .from("label_scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("creado_en", desde);

  // Sin poder contar no se llama: un techo que falla abierto no es un techo.
  if (errConteo) {
    return NextResponse.json(
      { error: "No se pudo comprobar tu cupo de lecturas. Escribe los valores a mano." },
      { status: 503 },
    );
  }
  if ((count ?? 0) >= LECTURAS_POR_DIA) {
    return NextResponse.json(
      {
        error: `Llegaste al límite de ${LECTURAS_POR_DIA} etiquetas por día. Puedes escribir los valores a mano.`,
      },
      { status: 429 },
    );
  }

  // --- la llamada ---
  let resultado;
  try {
    resultado = await leerEtiqueta({ base64: cuerpo.fotoBase64, mediaType: cuerpo.fotoMediaType });
  } catch (err) {
    console.error("leerEtiqueta falló:", err);
    return NextResponse.json(
      { error: "No se pudo leer la etiqueta ahora. Puedes escribir los valores a mano." },
      { status: 502 },
    );
  }

  // Se anota después de la llamada que gastó: si el modelo falla, no cuenta.
  // Que el registro falle no debe perder una lectura que ya se pagó.
  await supabase.from("label_scans").insert({
    user_id: user.id,
    modelo: resultado.modelo,
    costo_usd: resultado.costoUsd,
  });

  return NextResponse.json({ lectura: sanearLectura(resultado.etiqueta) });
}
