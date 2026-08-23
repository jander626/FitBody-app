import "server-only";

import type { Alimento } from "@/lib/alimentos";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Trae la tabla de alimentos visible para esta persona: la semilla pública
 * más los que haya creado.
 *
 * Se trae entera (~133 filas) porque el buscador filtra en el cliente y el
 * prompt de la IA necesita el vocabulario completo de todos modos.
 */
export async function listarAlimentos(): Promise<Alimento[]> {
  const supabase = await clienteServidor();

  const { data, error } = await supabase
    .from("foods")
    .select(
      "id, slug, nombre, categoria, kcal100, p100, c100, g100, porcion_g, porcion_nota",
    )
    .order("nombre");

  if (error) throw new Error(`No se pudo leer la tabla de alimentos: ${error.message}`);

  return (data ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    categoria: f.categoria,
    kcal100: f.kcal100,
    p100: f.p100,
    c100: f.c100,
    g100: f.g100,
    porcionG: f.porcion_g,
    porcionNota: f.porcion_nota,
  }));
}
