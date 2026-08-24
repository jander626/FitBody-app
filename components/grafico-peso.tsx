"use client";

import { useId, useState } from "react";
import { calcularDominio } from "@/lib/grafico";
import type { PuntoTendencia } from "@/lib/nutrition";

/**
 * Curva de peso.
 *
 * Es una serie temporal, así que va como línea. Dos series con trabajos
 * distintos:
 *
 *  - **El peso diario** es contexto, no protagonista: agua, sal y glucógeno lo
 *    mueven ±1 kg sin que cambie un gramo de grasa. Va tenue y con puntos.
 *  - **La media móvil de 7 días** es la señal, y por eso es la línea gruesa.
 *
 * Un solo eje. La meta se dibuja como referencia punteada, no como serie.
 */

const ANCHO = 720;
const ALTO = 260;
const M = { arriba: 16, derecha: 14, abajo: 26, izquierda: 38 };

export function GraficoPeso({
  serie,
  pesoMetaKg,
}: {
  serie: PuntoTendencia[];
  pesoMetaKg: number | null;
}) {
  const idRecorte = useId();
  const [activo, setActivo] = useState<number | null>(null);

  if (serie.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Con dos pesajes ya se dibuja la curva. Va {serie.length}.
      </p>
    );
  }

  const conMedia = serie.filter((p) => p.mediaKg !== null);

  // El dominio sale SOLO de los datos, nunca de la meta (ver lib/grafico.ts).
  const { y0, y1, metaVisible } = calcularDominio(
    [...serie.map((p) => p.pesoKg), ...conMedia.map((p) => p.mediaKg!)],
    pesoMetaKg,
  );

  const anchoInterno = ANCHO - M.izquierda - M.derecha;
  const altoInterno = ALTO - M.arriba - M.abajo;

  const X = (i: number) =>
    M.izquierda + (i / (serie.length - 1)) * anchoInterno;
  const Y = (v: number) =>
    M.arriba + altoInterno - ((v - y0) / (y1 - y0)) * altoInterno;

  const linea = (puntos: { i: number; v: number }[]) =>
    puntos.map((p, n) => `${n === 0 ? "M" : "L"}${X(p.i)} ${Y(p.v)}`).join(" ");

  const puntosDiarios = serie.map((p, i) => ({ i, v: p.pesoKg }));
  const puntosMedia = serie
    .map((p, i) => ({ i, v: p.mediaKg }))
    .filter((p): p is { i: number; v: number } => p.v !== null);

  // Tres marcas en el eje: suficientes para leer la escala sin ensuciar.
  const marcasY = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];

  const punto = activo !== null ? serie[activo] : null;

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="block h-auto w-full touch-pan-y"
          role="img"
          aria-label={`Peso de ${serie[0].fecha} a ${serie[serie.length - 1].fecha}: de ${serie[0].pesoKg} a ${serie[serie.length - 1].pesoKg} kilos.`}
          onMouseLeave={() => setActivo(null)}
          onMouseMove={(e) => {
            const caja = e.currentTarget.getBoundingClientRect();
            const rel = ((e.clientX - caja.left) / caja.width) * ANCHO;
            const i = Math.round(
              ((rel - M.izquierda) / anchoInterno) * (serie.length - 1),
            );
            setActivo(Math.min(serie.length - 1, Math.max(0, i)));
          }}
        >
          <defs>
            <clipPath id={idRecorte}>
              <rect
                x={M.izquierda}
                y={M.arriba}
                width={anchoInterno}
                height={altoInterno}
              />
            </clipPath>
          </defs>

          {/* Rejilla recesiva: está para leer valores, no para mirarse. */}
          {marcasY.map((v) => (
            <g key={v}>
              <line
                x1={M.izquierda}
                x2={ANCHO - M.derecha}
                y1={Y(v)}
                y2={Y(v)}
                stroke="var(--hairline-soft)"
                strokeWidth={1}
              />
              <text
                x={M.izquierda - 8}
                y={Y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
              >
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {pesoMetaKg !== null &&
            (metaVisible ? (
              <>
                <line
                  x1={M.izquierda}
                  x2={ANCHO - M.derecha}
                  y1={Y(pesoMetaKg)}
                  y2={Y(pesoMetaKg)}
                  stroke="var(--good)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                <text
                  x={ANCHO - M.derecha}
                  y={Y(pesoMetaKg) - 6}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--good)"
                >
                  meta {pesoMetaKg}
                </text>
              </>
            ) : (
              // La meta queda fuera de la escala: se anota en el borde hacia
              // donde está, sin deformar el gráfico.
              <text
                x={ANCHO - M.derecha}
                y={pesoMetaKg < y0 ? M.arriba + altoInterno - 6 : M.arriba + 12}
                textAnchor="end"
                fontSize={11}
                fill="var(--good)"
              >
                meta {pesoMetaKg} {pesoMetaKg < y0 ? "↓" : "↑"}
              </text>
            ))}

          <g clipPath={`url(#${idRecorte})`}>
            {/* Peso diario: contexto. Tenue, para que no compita. */}
            <path
              d={linea(puntosDiarios)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeOpacity={0.28}
              strokeLinejoin="round"
            />
            {puntosDiarios.map((p) => (
              <circle
                key={p.i}
                cx={X(p.i)}
                cy={Y(p.v)}
                r={2}
                fill="var(--accent)"
                fillOpacity={0.35}
              />
            ))}

            {/* Media móvil: la señal. */}
            <path
              d={linea(puntosMedia)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Fechas de los extremos. */}
          <text x={M.izquierda} y={ALTO - 8} fontSize={11} fill="var(--muted)">
            {serie[0].fecha.slice(5)}
          </text>
          <text
            x={ANCHO - M.derecha}
            y={ALTO - 8}
            textAnchor="end"
            fontSize={11}
            fill="var(--muted)"
          >
            {serie[serie.length - 1].fecha.slice(5)}
          </text>

          {activo !== null && (
            <g pointerEvents="none">
              <line
                x1={X(activo)}
                x2={X(activo)}
                y1={M.arriba}
                y2={M.arriba + altoInterno}
                stroke="var(--muted)"
                strokeWidth={1}
              />
              <circle
                cx={X(activo)}
                cy={Y(serie[activo].pesoKg)}
                r={4}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      </div>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          Tendencia (7 días)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: "var(--accent)", opacity: 0.35 }}
          />
          Peso diario
        </span>
        {punto && (
          <span className="ml-auto font-mono tabular-nums text-ink-2">
            {punto.fecha.slice(5)} · {punto.pesoKg.toFixed(1)} kg
            {punto.mediaKg !== null && ` · tend. ${punto.mediaKg.toFixed(1)}`}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
