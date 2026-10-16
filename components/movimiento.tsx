"use client";

import { useEffect, useState } from "react";

/**
 * Un número que sube hasta su valor en vez de aparecer ya puesto.
 *
 * Con "reducir movimiento" activado devuelve el valor de una vez. El estado
 * se actualiza dentro del callback de la animación, nunca de forma síncrona
 * en el efecto: así no hay un render extra al montar.
 */
export function useCuenta(valor: number, duracionMs = 900): number {
  const [actual, setActual] = useState(0);

  useEffect(() => {
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicio = performance.now();
    let cuadro = 0;

    const paso = (ahora: number) => {
      const t = reducir ? 1 : Math.min(1, (ahora - inicio) / duracionMs);
      // easeOutCubic: arranca rápido y se asienta, como un número que "cae".
      const e = 1 - Math.pow(1 - t, 3);
      setActual(valor * e);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, duracionMs]);

  return actual;
}

/** Posiciones fijas: aleatorias darían un HTML distinto en cada render. */
const PIEZAS = [
  { dx: -70, dy: -64, r: 160, c: "var(--accent)" },
  { dx: 70, dy: -70, r: -140, c: "var(--macro-carb)" },
  { dx: -92, dy: -14, r: 90, c: "var(--macro-prot)" },
  { dx: 94, dy: -20, r: -80, c: "var(--macro-gras)" },
  { dx: -48, dy: -96, r: 200, c: "var(--macro-gras)" },
  { dx: 52, dy: -98, r: -190, c: "var(--accent)" },
  { dx: -84, dy: 36, r: 120, c: "var(--macro-carb)" },
  { dx: 86, dy: 30, r: -110, c: "var(--macro-prot)" },
];

/** Una ráfaga de papelitos que sale del centro de su contenedor, una vez. */
export function Confeti() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {PIEZAS.map((p, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 rounded-sm"
          style={
            {
              background: p.c,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--r": `${p.r}deg`,
              animation: `confeti 900ms cubic-bezier(0.2, 0.7, 0.3, 1) ${i * 25}ms both`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
