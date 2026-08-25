"use client";

import { useEffect } from "react";

/**
 * Marca lo que estás tocando.
 *
 * Esto existe porque `:active` solo no alcanza. **iOS Safari no aplica
 * `:active` a un elemento al tocarlo** salvo que la página tenga escuchas de
 * eventos táctiles — una particularidad vieja de Safari. En Chromium con
 * táctil emulado el CSS funciona, así que el problema no aparece al probarlo
 * ahí: aparece en el teléfono, que es donde vive la app.
 *
 * En vez de pelear con eso, la pulsación se marca desde acá con un atributo, y
 * el CSS estiliza el atributo. Una sola escucha delegada en el documento cubre
 * todos los botones, incluidos los que aparezcan después.
 *
 * El `:active` del CSS se deja igual como respaldo: si este componente no
 * llegara a montar, la app sigue respondiendo aunque sea con menos fuerza.
 */

/** Lo que cuenta como tocable. Coincide con lo que estiliza globals.css. */
const TOCABLE = 'button, a, label[for], summary, [role="button"], select';

const ATRIBUTO = "data-pulsado";

export function Pulsacion() {
  useEffect(() => {
    let marcado: Element | null = null;

    const limpiar = () => {
      marcado?.removeAttribute(ATRIBUTO);
      marcado = null;
    };

    const alPresionar = (evento: PointerEvent) => {
      // Solo el botón principal: un clic derecho o el borde de la palma no
      // deberían encender nada.
      if (evento.button !== 0) return;

      const destino = (evento.target as Element | null)?.closest?.(TOCABLE);
      if (!destino) return;

      // Un control apagado no finge que responde.
      if (
        (destino as HTMLButtonElement).disabled ||
        destino.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }

      limpiar();
      destino.setAttribute(ATRIBUTO, "");
      marcado = destino;
    };

    // En captura para que se marque aunque algo más detenga la propagación.
    document.addEventListener("pointerdown", alPresionar, { capture: true, passive: true });
    document.addEventListener("pointerup", limpiar, { passive: true });
    document.addEventListener("pointercancel", limpiar, { passive: true });
    // Al arrastrar para desplazar, el dedo sale del botón: la marca tiene que
    // irse ahí, o queda un botón encendido mientras se hace scroll.
    document.addEventListener("scroll", limpiar, { capture: true, passive: true });
    // Volver de otra app con el dedo levantado no dispara pointerup.
    window.addEventListener("blur", limpiar);

    return () => {
      document.removeEventListener("pointerdown", alPresionar, { capture: true });
      document.removeEventListener("pointerup", limpiar);
      document.removeEventListener("pointercancel", limpiar);
      document.removeEventListener("scroll", limpiar, { capture: true });
      window.removeEventListener("blur", limpiar);
      limpiar();
    };
  }, []);

  return null;
}
