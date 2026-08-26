"use client";

import { useSyncExternalStore } from "react";

/** No hay nada a qué suscribirse: pasa de false a true una sola vez. */
const sinSuscripcion = () => () => {};

/**
 * Si el componente ya está corriendo en el navegador.
 *
 * Sirve para lo que solo existe del lado del cliente —`localStorage`, la zona
 * horaria, el ancho de la pantalla—. Si se leyera directamente al renderizar,
 * el servidor pintaría una cosa y el cliente otra, y React se queja con razón:
 * el HTML que llegó no es el que le corresponde.
 *
 * Va con `useSyncExternalStore` y no con un `useState` + `useEffect` porque
 * eso es exactamente lo que la regla `react-hooks/set-state-in-effect`
 * prohíbe, y porque React ya sabe hacer esto: durante la hidratación usa la
 * versión del servidor, después la del cliente.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
}
