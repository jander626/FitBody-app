"use client";

import { useState } from "react";

/**
 * La curva de hoy al peso objetivo.
 *
 * Es una proyección, no una promesa: la forma (arranca rápido y se asienta)
 * imita cómo se comporta el peso en la práctica, y las fechas salen de las
 * semanas estimadas del plan. El texto que la acompaña lo dice.
 */
export function ProyeccionPeso({
  pesoKg,
  metaKg,
  semanas,
}: {
  pesoKg: number;
  metaKg: number;
  semanas: number;
}) {
  // La fecha de hoy se fija una vez al montar, no en cada render.
  const [hoy] = useState(() => new Date());
  const fecha = (diasDesdeHoy: number) =>
    new Date(hoy.getTime() + diasDesdeHoy * 86_400_000).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
    });

  const W = 320;
  const H = 190;
  const x0 = 28;
  const x1 = W - 28;
  const baja = metaKg < pesoKg;
  const y0 = baja ? 40 : 140;
  const y1 = baja ? 140 : 40;
  const k = (x1 - x0) * 0.5;
  const curva = `M ${x0} ${y0} C ${x0 + k} ${y0}, ${x1 - k} ${y1}, ${x1} ${y1}`;
  const area = `${curva} L ${x1} ${H - 20} L ${x0} ${H - 20} Z`;

  const fmt = (n: number) => String(n).replace(".", ",");
  const fin = semanas * 7;

  return (
    <figure
      role="img"
      aria-label={`De ${fmt(pesoKg)} kilos hoy a ${fmt(metaKg)} kilos en unas ${semanas} semanas`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[60, 100, 140].map((y) => (
          <line key={y} x1={x0} x2={x1} y1={y} y2={y} stroke="var(--hairline)" strokeDasharray="4 5" />
        ))}
        <path
          d={area}
          fill="var(--accent)"
          fillOpacity="0.12"
          style={{ animation: "aparece 700ms ease 900ms backwards" }}
        />
        <path
          d={curva}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          style={{ animation: "dibuja 1400ms cubic-bezier(0.4, 0, 0.2, 1) 200ms backwards" }}
        />
        <circle cx={x0} cy={y0} r="7" fill="var(--accent)" />
        <g style={{ animation: "pop 400ms ease 1500ms backwards", transformOrigin: `${x1}px ${y1}px` }}>
          <circle cx={x1} cy={y1} r="9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="4" />
        </g>
      </svg>

      <div className="-mt-2 flex items-start justify-between gap-2 text-sm">
        <div>
          <p className="font-mono text-lg font-semibold text-ink tabular-nums">{fmt(pesoKg)} kg</p>
          <p className="text-xs text-muted">Hoy</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold text-accent tabular-nums">{fmt(metaKg)} kg</p>
          <p className="text-xs text-muted">{fecha(fin)}</p>
        </div>
      </div>
    </figure>
  );
}
