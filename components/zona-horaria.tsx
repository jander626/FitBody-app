"use client";

import { useEffect } from "react";
import { COOKIE_ZONA } from "@/lib/zona";

/**
 * Le dice al servidor en qué zona horaria estás.
 *
 * El servidor no tiene forma de saberlo: corre en el centro de datos que le
 * tocó a Vercel, y `new Date()` ahí es UTC. El navegador sí lo sabe con
 * certeza, así que lo escribe en una cookie que el servidor lee al renderizar.
 *
 * Se reescribe en cada carga a propósito, no solo la primera vez: si viajás,
 * el teléfono cambia de zona y la app tiene que seguirlo sin que haya que
 * tocar nada. Y renueva el vencimiento, para que no caduque por no usarla.
 *
 * Sin `Secure` porque en desarrollo se sirve por http; `SameSite=Lax` alcanza
 * — no es un dato sensible, es en qué huso horario está el teléfono.
 */

const UN_ANIO = 60 * 60 * 24 * 365;

export function ZonaHoraria() {
  useEffect(() => {
    try {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zona) return;

      const yaEsta = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${COOKIE_ZONA}=`))
        ?.slice(COOKIE_ZONA.length + 1);

      document.cookie = `${COOKIE_ZONA}=${encodeURIComponent(zona)}; path=/; max-age=${UN_ANIO}; samesite=lax`;

      // Si cambió de verdad, lo que ya está pintado quedó con la fecha vieja.
      // Pasa al viajar, y la primera vez que se abre la app: hasta ese momento
      // el servidor estaba usando la zona por defecto.
      if (yaEsta !== zona) {
        // Un reload y no router.refresh(): la fecha se calcula en el servidor
        // durante el render, y refresh() reusa la respuesta ya generada.
        window.location.reload();
      }
    } catch {
      // Sin cookies ni Intl, el servidor usa la zona configurada. La app
      // funciona; solo puede equivocarse de día cerca de medianoche.
    }
  }, []);

  return null;
}
