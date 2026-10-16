"use client";

import { puntoEnArco, trazoArco } from "@/lib/arco";
import { colorMedidor, estadoMacro, type EstadoMedidor } from "./medidor";
import { useCuenta } from "./movimiento";

interface Macro {
  etiqueta: string;
  valor: number;
  objetivo: number;
  /** La proteína se persigue hacia arriba; el resto son techos. */
  minimo?: boolean;
  tono: string;
}

/**
 * El corazón de la pantalla Hoy: cuánto queda, en grande, y cómo van los macros.
 *
 * El arco se llena con lo consumido y el número central cuenta lo que queda:
 * así la forma dice "cuánto llevo" y el número dice "cuánto puedo". Al pasarse
 * del objetivo todo vira a rojo y el número dice "de más". El número siempre
 * va escrito, así que la forma no es la única señal.
 */
export function MedidorDia({
  consumido,
  objetivo,
  macros,
}: {
  consumido: number;
  objetivo: number;
  macros: Macro[];
}) {
  const restante = objetivo - consumido;
  const excedido = consumido > objetivo * 1.05;
  const fraccion = objetivo > 0 ? Math.min(1, Math.max(0, consumido / objetivo)) : 0;
  const animado = useCuenta(Math.abs(restante), 1000);
  const estado: EstadoMedidor = excedido ? "excedido" : "progreso";
  const color = colorMedidor(estado);
  const marca = puntoEnArco(fraccion);

  return (
    <div>
      <div
        className="relative mx-auto w-full max-w-xs"
        role="meter"
        aria-valuenow={Math.round(consumido)}
        aria-valuemin={0}
        aria-valuemax={objetivo}
        aria-label={`Calorías: ${Math.round(consumido)} de ${objetivo}`}
      >
        <svg viewBox="0 -10 200 120" className="w-full" aria-hidden="true">
          <path d={trazoArco(0, 1)} fill="none" stroke={color} strokeOpacity="0.16" strokeWidth="12" strokeLinecap="round" />
          {fraccion > 0.005 && (
            <>
              <path
                d={trazoArco(0, fraccion)}
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                className="llena"
                style={{ "--v": 0 } as React.CSSProperties}
              />
              <g style={{ animation: "pop 400ms ease 1100ms backwards", transformOrigin: `${marca.x}px ${marca.y}px` }}>
                <circle cx={marca.x} cy={marca.y} r="8" fill="var(--surface)" stroke={color} strokeWidth="4" />
              </g>
            </>
          )}
        </svg>

        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className={`font-mono text-4xl font-semibold tabular-nums ${excedido ? "text-bad" : "text-ink"}`}>
            {Math.round(animado).toLocaleString("es-CO")}
          </p>
          <p className="text-xs text-muted">kcal {restante < 0 ? "de más" : "restantes"}</p>
        </div>
      </div>

      <p className="mt-2 text-center text-sm text-muted">
        <span className="font-mono tabular-nums">{Math.round(consumido).toLocaleString("es-CO")}</span> de{" "}
        <span className="font-mono tabular-nums">{objetivo.toLocaleString("es-CO")}</span> kcal
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {macros.map((m, i) => {
          const est = estadoMacro(m.valor, m.objetivo, Boolean(m.minimo));
          const pct = m.objetivo > 0 ? Math.min(100, (m.valor / m.objetivo) * 100) : 0;
          return (
            <div key={m.etiqueta}>
              <p className="text-xs text-muted">{m.etiqueta}</p>
              <p className="font-mono text-sm text-ink tabular-nums">
                {Math.round(m.valor)}
                <span className="text-muted"> / {m.objetivo} g</span>
              </p>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                style={{ background: `color-mix(in oklab, ${colorMedidor(est, m.tono)} 16%, var(--surface))` }}
                role="meter"
                aria-valuenow={Math.round(m.valor)}
                aria-valuemin={0}
                aria-valuemax={m.objetivo}
                aria-label={`${m.etiqueta}: ${Math.round(m.valor)} de ${m.objetivo} g${m.minimo ? " (mínimo)" : ""}`}
              >
                <div
                  className="crece-x h-full rounded-full"
                  style={{ width: `${pct}%`, background: colorMedidor(est, m.tono), "--i": i } as React.CSSProperties}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">La proteína se persigue hacia arriba; el resto son techos.</p>
    </div>
  );
}
