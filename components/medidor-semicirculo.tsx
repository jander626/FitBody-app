"use client";

import { useCuenta } from "./movimiento";

/**
 * Medidor de arco para un objetivo con margen.
 *
 * Muestra un número central que sube hasta su valor, y debajo el rango en que
 * el día cuenta como bueno. El arco se dibuja de izquierda a derecha al
 * aparecer. El dato completo va escrito: el arco acompaña, no es la única
 * forma de leer el número.
 */
export function MedidorSemicirculo({
  valor,
  unidad,
  min,
  max,
}: {
  valor: number;
  unidad: string;
  min: number;
  max: number;
}) {
  const animado = useCuenta(valor, 1100);

  // Semicírculo de radio 90 centrado en (100, 100); `t` va de 0 a 1.
  const punto = (t: number) => {
    const ang = Math.PI * (1 - t);
    return { x: 100 + 90 * Math.cos(ang), y: 100 - 90 * Math.sin(ang) };
  };
  const arco = (desde: number, hasta: number) => {
    const a = punto(desde);
    const b = punto(hasta);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A 90 90 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };

  const marca = punto(0.5);

  return (
    <figure
      className="text-center"
      role="img"
      aria-label={`${valor} ${unidad} al día, con un rango de ${min} a ${max} ${unidad}`}
    >
      <p className="font-mono text-5xl font-semibold text-ink tabular-nums">
        {Math.round(animado).toLocaleString("es-CO")}
        <span className="ml-1 text-base font-normal text-muted">{unidad}</span>
      </p>

      <svg viewBox="0 -10 200 115" className="mx-auto mt-2 w-full max-w-xs" aria-hidden="true">
        <path
          d={arco(0, 1)}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.2"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={arco(0.04, 0.96)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          style={{ animation: "dibuja 1200ms cubic-bezier(0.4, 0, 0.2, 1) 100ms both" }}
        />
        <g style={{ animation: "pop 400ms ease 1100ms both", transformOrigin: `${marca.x}px ${marca.y}px` }}>
          <circle cx={marca.x} cy={marca.y} r="9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="4" />
        </g>
      </svg>

      <figcaption className="mt-1 flex justify-between px-1 text-sm text-muted">
        <span>
          <span className="block text-xs">Mínimo</span>
          <span className="font-mono text-ink-2 tabular-nums">{min.toLocaleString("es-CO")}</span>
        </span>
        <span>
          <span className="block text-xs">Máximo</span>
          <span className="font-mono text-ink-2 tabular-nums">{max.toLocaleString("es-CO")}</span>
        </span>
      </figcaption>
    </figure>
  );
}
