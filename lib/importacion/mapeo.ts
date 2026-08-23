/**
 * Traducción de la bitácora al esquema de la app.
 *
 * Vive aparte del script de importación y sin dependencias porque acá están
 * todas las decisiones con criterio —qué es un "snack tarde", qué significa
 * "foto (menu) + confirmacion del usuario"— y esas hay que poder probarlas
 * sin levantar una base.
 */
import { normalizar } from "../texto";


/** Momentos que acepta el esquema. */
export type Momento =
  | "desayuno"
  | "almuerzo"
  | "cena"
  | "snack"
  | "postre"
  | "bebida"
  | "otro";

export type Confianza = "alta" | "media" | "baja";

export type Origen = "foto" | "descripcion" | "foto+descripcion" | "manual";

// normalizar y slugificar viven en lib/texto.ts: los usa también el buscador
// en el navegador, y no tiene por qué arrastrar el código del importador.
export { normalizar, slugificar } from "../texto";

/**
 * Normaliza el momento de la comida.
 *
 * "snack tarde" colapsa a "snack": la hora del día es información que ya
 * tiene su propia columna, y multiplicar los momentos por franja horaria
 * complicaría el diario sin agregar nada.
 */
export function aMomento(valor: string | undefined): Momento {
  const v = normalizar(valor ?? "");
  if (v.startsWith("desayuno")) return "desayuno";
  if (v.startsWith("almuerzo")) return "almuerzo";
  if (v.startsWith("cena")) return "cena";
  if (v.startsWith("snack") || v.startsWith("merienda")) return "snack";
  if (v.startsWith("postre")) return "postre";
  if (v.startsWith("bebida") || v.startsWith("trago")) return "bebida";
  return "otro";
}

/**
 * Normaliza la confianza a tres niveles.
 *
 * "media-alta" baja a "media" a propósito. La confianza decide si la app
 * insiste en confirmar un dato; cuando el valor cae entre dos niveles,
 * redondear hacia abajo hace que se pregunte de más, no de menos. En una app
 * de salud ese es el error barato.
 */
export function aConfianza(valor: string | undefined): Confianza | null {
  if (!valor) return null;
  const v = normalizar(valor);
  if (v === "alta") return "alta";
  if (v === "baja") return "baja";
  // media, media-alta, media-baja y cualquier matiz intermedio.
  if (v.includes("media")) return "media";
  return null;
}

/**
 * Interpreta el `origen` en texto libre de la bitácora.
 *
 * En los datos hay nueve variantes distintas ("reporte en texto", "foto
 * (menu) + confirmacion del usuario", "foto (etiqueta nutricional)"…). Lo que
 * importa de todas ellas son dos cosas: si hubo una foto, y si la persona
 * aportó información además de la foto.
 */
export function interpretarOrigen(valor: string | undefined): {
  origen: Origen;
  corregido: boolean;
} {
  if (!valor) return { origen: "manual", corregido: false };

  const v = normalizar(valor);

  // Ojo con las negaciones. En la bitácora hay un origen que dice "comida
  // callejera sin foto del plato final": contiene la palabra "foto" y
  // significa exactamente lo contrario. Se descartan esas frases antes de
  // buscar.
  const sinNegaciones = v.replace(/\bsin (foto|imagen)\b/g, " ");
  const hayFoto = sinNegaciones.includes("foto");
  // "descripcion", "confirmacion", "reporto"/"reporte", "indicada"...
  const hayTexto =
    v.includes("descripcion") ||
    v.includes("confirmacion") ||
    v.includes("report") ||
    v.includes("indicada") ||
    v.includes("usuario");
  const corregido = v.includes("correccion");

  if (hayFoto && hayTexto) return { origen: "foto+descripcion", corregido };
  if (hayFoto) return { origen: "foto", corregido };
  if (hayTexto) return { origen: "descripcion", corregido };
  return { origen: "manual", corregido };
}

/**
 * Junta las notas sueltas de un ítem en una sola.
 *
 * La bitácora las escribe indistintamente como `nota`, `nota_porcion` o
 * `porcion_nota`. Quedarse con una sola y descartar el resto perdería texto
 * escrito a mano, que es justo lo que hace preciso al registro.
 */
export function notaDeItem(item: {
  nota?: string;
  nota_porcion?: string;
  porcion_nota?: string;
}): string | null {
  const partes = [item.nota, item.nota_porcion, item.porcion_nota]
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim());

  if (partes.length === 0) return null;
  return [...new Set(partes)].join(" · ");
}
