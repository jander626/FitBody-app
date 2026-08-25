"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cuadriculaMes,
  sumarMeses,
  type EstadoDia,
  type ResumenDia,
} from "@/lib/historial";

/**
 * Calendario del historial.
 *
 * El estado del día va en dos canales, no solo en el color: verde y rojo lo
 * separan bien, y el relleno contra el contorno distingue "cumplí el objetivo"
 * de "me pasé del objetivo pero seguí en déficit". Tres colores cálidos no
 * entran en la banda de luminosidad del modo oscuro sin volverse
 * indistinguibles, y el color solo nunca debería ser el único canal.
 *
 * Los días sin registro no se pueden tocar: llevan a una pantalla vacía y no
 * hay nada que mirar ahí.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];

function estilo(estado: EstadoDia, esHoy: boolean): string {
  const base = "relative flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition-colors";
  const hoy = esHoy ? " ring-2 ring-accent ring-offset-1 ring-offset-surface" : "";

  switch (estado) {
    case "objetivo":
      return `${base}${hoy} bg-good text-white font-medium`;
    case "deficit":
      return `${base}${hoy} border-2 border-good text-good font-medium`;
    case "sin_deficit":
      return `${base}${hoy} bg-bad text-white font-medium`;
    default:
      return `${base}${hoy} text-muted/50 cursor-default`;
  }
}

export function Calendario({
  dias,
  hoy,
  seleccionado,
}: {
  dias: ResumenDia[];
  hoy: string;
  seleccionado?: string;
}) {
  const router = useRouter();
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));

  // Arranca en el mes del día más reciente con registro, no en el mes actual:
  // si hace tres días que no registrás, lo útil es ver dónde están los datos.
  const referencia = seleccionado ?? dias[0]?.fecha ?? hoy;
  const [vista, setVista] = useState(() => ({
    anio: Number(referencia.slice(0, 4)),
    mes: Number(referencia.slice(5, 7)) - 1,
  }));

  const celdas = cuadriculaMes(vista.anio, vista.mes);
  const hayAnteriores = dias.some(
    (d) => d.fecha < `${vista.anio}-${String(vista.mes + 1).padStart(2, "0")}-01`,
  );
  const finDeMes = `${vista.anio}-${String(vista.mes + 1).padStart(2, "0")}-31`;
  const haySiguientes = dias.some((d) => d.fecha > finDeMes);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVista((v) => sumarMeses(v.anio, v.mes, -1))}
          disabled={!hayAnteriores}
          aria-label="Mes anterior"
          className="flex size-8 items-center justify-center rounded-lg text-muted disabled:opacity-25"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-ink">
          {MESES[vista.mes]} {vista.anio}
        </span>
        <button
          type="button"
          onClick={() => setVista((v) => sumarMeses(v.anio, v.mes, 1))}
          disabled={!haySiguientes}
          aria-label="Mes siguiente"
          className="flex size-8 items-center justify-center rounded-lg text-muted disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {INICIALES.map((inicial, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="pb-1 text-center text-xs text-muted"
          >
            {inicial}
          </div>
        ))}

        {celdas.map((fecha, i) => {
          if (fecha === null) return <div key={`v${i}`} />;

          const dia = porFecha.get(fecha);
          const estado = dia?.estado ?? "sin_registro";
          const numero = Number(fecha.slice(8, 10));
          const sinRegistro = !dia;

          if (sinRegistro) {
            return (
              <div
                key={fecha}
                className={estilo("sin_registro", fecha === hoy)}
                aria-label={`${numero}: sin registro`}
              >
                {numero}
              </div>
            );
          }

          return (
            <button
              key={fecha}
              type="button"
              onClick={() =>
                router.push(fecha === hoy ? "/hoy" : `/hoy?fecha=${fecha}`)
              }
              aria-label={`${numero} de ${MESES[vista.mes]}: ${Math.round(dia.kcal)} kilocalorías, ${ETIQUETA[estado]}`}
              className={estilo(estado, fecha === hoy)}
            >
              {numero}
            </button>
          );
        })}
      </div>

      <Leyenda />
    </div>
  );
}

const ETIQUETA: Record<EstadoDia, string> = {
  objetivo: "dentro del objetivo",
  deficit: "en déficit, sobre el objetivo",
  sin_deficit: "sin déficit",
  sin_registro: "sin registro",
};

function Leyenda() {
  return (
    <ul className="mt-4 space-y-1.5 text-xs text-muted">
      <li className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded bg-good" />
        Dentro del objetivo
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded border-2 border-good" />
        En déficit, pero sobre el objetivo
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded bg-bad" />
        Sin déficit: comiste sobre el gasto
      </li>
      <li className="flex items-center gap-2">
        <span className="size-3.5 shrink-0 rounded bg-hairline" />
        Sin registro
      </li>
    </ul>
  );
}
