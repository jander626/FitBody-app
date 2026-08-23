"use client";

import { useEffect } from "react";

/** Registra el service worker una vez cargada la página. Sin UI. */
export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Que falle el SW no debe romper la app: solo pierde el modo offline.
        console.warn("No se pudo registrar el service worker", err);
      });
    };

    if (document.readyState === "complete") registrar();
    else {
      window.addEventListener("load", registrar);
      return () => window.removeEventListener("load", registrar);
    }
  }, []);

  return null;
}
