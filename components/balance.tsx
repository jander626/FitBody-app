"use client";

import type { ResumenDia } from "@/lib/historial";

/**
 * Balance calórico por día.
 *
 * Una barra por día contra dos referencias: el objetivo y el gasto estimado.
 * Lo que se lee de un vistazo es **el espacio entre la barra y la línea del
 * gasto**, que es el déficit real de ese día — no lo que dice la barra sola.
 *
 * Un solo eje. Las referencias son líneas punteadas, no series.
 */

const ALTO = 180;
const M = { arriba: 14, derecha: 8, abajo: 18, izquierda: 34 };

export function Balance({
  dias,
  objetivoKcal,
  gastoKcal,
}: {
  dias: ResumenDia[];
  objetivoKcal: number;
  gastoKcal: number;
}) {
  if (dias.length === 0) return null;

  // De más viejo a más nuevo: el tiempo va hacia la derecha.
  const serie = [...dias].reverse();
  const ancho = Math.max(320, serie.length * 26 + M.izquierda + M.derecha);

  const techo = Math.max(gastoKcal, ...serie.map((d) => d.kcal)) * 1.08;
  const anchoInterno = ancho - M.izquierda - M.derecha;
  const altoInterno = ALTO - M.arriba - M.abajo;

  const Y = (v: number) => M.arriba + altoInterno - (v / techo) * altoInterno;
  const anchoBarra = Math.min(18, (anchoInterno / serie.length) * 0.68);

  return (
    <figure className="m-0">
      {/* Se desplaza en su propio contenedor: la página nunca scrollea al lado. */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${ancho} ${ALTO}`}
          style={{ width: ancho, maxWidth: "none" }}
          className="h-auto"
          role="img"
          aria-label={`Calorías por día del ${serie[0].fecha} al ${serie[serie.length - 1].fecha}, comparadas con el objetivo de ${objetivoKcal} y el gasto estimado de ${gastoKcal}.`}
        >
          {[0, techo / 2, techo].map((v) => (
            <text
              key={v}
              x={M.izquierda - 6}
              y={Y(v) + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted)"
            >
              {Math.round(v / 100) * 100}
            </text>
          ))}

          {serie.map((d, i) => {
            const x = M.izquierda + (i + 0.5) * (anchoInterno / serie.length);
            const y = Y(d.kcal);
            const color =
              d.estado === "sin_deficit" ? "var(--bad)" : "var(--accent)";
            return (
              <g key={d.fecha}>
                <rect
                  x={x - anchoBarra / 2}
                  y={y}
                  width={anchoBarra}
                  height={M.arriba + altoInterno - y}
                  rx={3}
                  fill={color}
                />
                <text
                  x={x}
                  y={ALTO - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted)"
                >
                  {Number(d.fecha.slice(8, 10))}
                </text>
              </g>
            );
          })}

          {/* Referencias. El gasto arriba, el objetivo abajo. */}
          <line
            x1={M.izquierda} x2={ancho - M.derecha}
            y1={Y(gastoKcal)} y2={Y(gastoKcal)}
            stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 3"
          />
          <line
            x1={M.izquierda} x2={ancho - M.derecha}
            y1={Y(objetivoKcal)} y2={Y(objetivoKcal)}
            stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 4"
          />
        </svg>
      </div>

      <figcaption className="mt-3 space-y-1 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
          Objetivo ({objetivoKcal.toLocaleString("es")} kcal)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 shrink-0 rounded-full" style={{ background: "var(--muted)" }} />
          Gasto estimado ({gastoKcal.toLocaleString("es")} kcal)
        </span>
        <span className="block pt-1">
          El espacio entre la barra y la línea del gasto es el déficit real que
          lograste ese día.
        </span>
      </figcaption>
    </figure>
  );
}
