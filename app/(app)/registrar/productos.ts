"use server";

import { z } from "zod";
import { esCodigoValido } from "@/lib/barcode/openfoodfacts";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { slugificar } from "@/lib/texto";

export type ResultadoProducto =
  | { ok: true; foodId: string }
  | { ok: false; error: string };

const ProductoSchema = z.object({
  codigo: z.string().refine(esCodigoValido, "El código de barras no es válido."),
  nombre: z.string().trim().min(1, "Falta el nombre del producto.").max(120),
  kcal100: z.number().min(0).max(900),
  p100: z.number().min(0).max(100),
  c100: z.number().min(0).max(100),
  g100: z.number().min(0).max(100),
  /** Tamaño de una porción, si la etiqueta lo dice. */
  porcionG: z.number().positive().max(2000).nullable(),
});

/**
 * Guarda un producto escaneado en la tabla de alimentos de quien lo escaneó.
 *
 * Es lo que hace que la base crezca: la próxima vez que se escanee ese código
 * sale de aquí, al instante y sin gastar una llamada. Se llama al leer una
 * etiqueta y también al agregar un producto que sí estaba en Open Food Facts,
 * para que la segunda vez ya no dependa de la red.
 *
 * Los valores se validan otra vez en el servidor: vienen del navegador, y el
 * formulario valida por comodidad, no por seguridad.
 */
export async function guardarProducto(datos: unknown): Promise<ResultadoProducto> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entra de nuevo." };

  const analisis = ProductoSchema.safeParse(datos);
  if (!analisis.success) {
    return { ok: false, error: analisis.error.issues[0]?.message ?? "Datos del producto inválidos." };
  }
  const p = analisis.data;

  // Los macros no pueden pesar más que lo que pesa el producto.
  if (p.p100 + p.c100 + p.g100 > 105) {
    return { ok: false, error: "Los macros suman más de 100 g por cada 100 g. Revisa los valores." };
  }

  const { data, error } = await supabase
    .from("foods")
    .upsert(
      {
        // El slug es único en toda la tabla, no solo por persona: lleva el
        // código y un trozo del usuario para que dos personas que escaneen el
        // mismo producto no choquen.
        slug: `${slugificar(p.nombre).slice(0, 60)}-${p.codigo}-${user.id.slice(0, 8)}`,
        nombre: p.nombre,
        categoria: "Producto empacado",
        kcal100: p.kcal100,
        p100: p.p100,
        c100: p.c100,
        g100: p.g100,
        porcion_g: p.porcionG,
        porcion_nota: p.porcionG ? "1 porción de la etiqueta" : null,
        publico: false,
        creado_por: user.id,
        codigo_barras: p.codigo,
      },
      { onConflict: "creado_por,codigo_barras" },
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, foodId: data.id };
}
