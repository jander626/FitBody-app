import "server-only";

import { anthropic } from "./anthropic";
import { gemini } from "./gemini";
import {
  elegirProveedor,
  NOMBRES,
  type NombreProveedor,
  type PeticionEstimacion,
  type Proveedor,
  type ResultadoEstimacion,
} from "./proveedor";

/**
 * La puerta de entrada a la IA.
 *
 * Todo lo que llama a un modelo pasa por acá: la ruta de registro y el script
 * de evaluación. Cuál modelo contesta se decide por configuración, no por
 * código, y el resto de la app no se entera.
 */

export type {
  PeticionEstimacion,
  ResultadoEstimacion,
  TurnoPrevio,
} from "./proveedor";

const PROVEEDORES: Record<NombreProveedor, Proveedor> = { anthropic, gemini };

/** El proveedor configurado, o un error que explica qué falta. */
export function proveedorActivo(): Proveedor {
  const elegido = elegirProveedor(process.env);

  if (!elegido) {
    throw new Error(
      "No hay ninguna clave de IA configurada. Poné GEMINI_API_KEY (tiene " +
        "capa gratuita) o ANTHROPIC_API_KEY. Mientras tanto el buscador y el " +
        "registro manual funcionan igual.",
    );
  }

  const proveedor = PROVEEDORES[elegido.nombre];

  // Elegir un proveedor y no ponerle la clave es el error más fácil de
  // cometer acá, y sin este chequeo el mensaje que sale es el del SDK, que no
  // dice cuál de las dos variables falta.
  if (elegido.motivo.includes("FITFOOD_PROVEEDOR")) {
    const clave =
      elegido.nombre === "gemini"
        ? (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)
        : process.env.ANTHROPIC_API_KEY;
    if (!clave) {
      throw new Error(
        `FITFOOD_PROVEEDOR="${elegido.nombre}" pero falta ${proveedor.variableClave}.`,
      );
    }
  }

  return proveedor;
}

/** Pide una estimación al modelo configurado. */
export async function estimar(
  peticion: PeticionEstimacion,
): Promise<ResultadoEstimacion> {
  return proveedorActivo().estimar(peticion);
}

export { NOMBRES };
