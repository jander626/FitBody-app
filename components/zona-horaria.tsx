"use client";

import { useEffect } from "react";
import { aValorDeCookie, COOKIE_ZONA, zonaDeCookies } from "@/lib/zona";

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

/** Marca de "ya recargué por esta zona", por pestaña. Ver `recargarUnaVez`. */
const CLAVE_RECARGA = "fitfood-zona-recargada";

/**
 * Recarga como mucho una vez por zona y por pestaña.
 *
 * La recarga arregla la pantalla que se pintó con la zona vieja, pero es una
 * herramienta peligrosa: si la condición que la dispara nunca se apaga, la
 * página se recarga sin parar y la app queda inservible —el campo del correo
 * se borra solo, y el refresco de sesión termina cerrándola. Ya pasó. Este
 * seguro hace que el peor caso sea una recarga de más, no infinitas.
 */
function recargarUnaVez(zona: string) {
  try {
    if (sessionStorage.getItem(CLAVE_RECARGA) === zona) return;
    sessionStorage.setItem(CLAVE_RECARGA, zona);
  } catch {
    // Sin sessionStorage (Safari privado) no hay seguro que valga: mejor no
    // recargar. Se pierde la corrección de la primera carga, no la app.
    return;
  }
  window.location.reload();
}

export function ZonaHoraria() {
  useEffect(() => {
    try {
      const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!zona) return;

      const yaEsta = zonaDeCookies(document.cookie);

      document.cookie = `${COOKIE_ZONA}=${aValorDeCookie(zona)}; path=/; max-age=${UN_ANIO}; samesite=lax`;

      // Si cambió de verdad, lo que ya está pintado quedó con la fecha vieja.
      // Pasa al viajar, y la primera vez que se abre la app: hasta ese momento
      // el servidor estaba usando la zona por defecto.
      if (yaEsta !== zona) {
        // Un reload y no router.refresh(): la fecha se calcula en el servidor
        // durante el render, y refresh() reusa la respuesta ya generada.
        recargarUnaVez(zona);
      }
    } catch {
      // Sin cookies ni Intl, el servidor usa la zona configurada. La app
      // funciona; solo puede equivocarse de día cerca de medianoche.
    }
  }, []);

  return null;
}
