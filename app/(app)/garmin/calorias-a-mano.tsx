"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta } from "@/components/ui";
import { nombreDia, ultimosDias } from "@/lib/garmin/dias";
import type { DiaMetrica } from "@/lib/garmin/csv";
import { guardarDiasGarmin } from "./acciones";

/**
 * Escribir las calorías a mano, mirando la pantalla de Garmin.
 *
 * Existe porque el informe de calorías no siempre se puede exportar a CSV: a
 * veces lo único que hay es lo que se ve en el teléfono. Son siete números por
 * semana —treinta segundos— y a cambio el déficit de cada día se calcula
 * contra el gasto medido en vez de contra la fórmula, que es la diferencia
 * entre un déficit real y uno supuesto.
 *
 * Solo pide las calorías totales. El resto de las métricas —pasos, sueño, FC—
 * sí exportan bien a CSV, y transcribir a mano lo que se puede importar es
 * pedir errores de tipeo a cambio de nada.
 */

/** Una semana más el día de hoy, que es el que puede ir a medias. */
const DIAS_VISIBLES = 8;

export function CaloriasAMano({
  hoy,
  guardadas,
}: {
  hoy: string;
  /** Lo que ya está en la base, por fecha, para poder corregirlo. */
  guardadas: Record<string, number | null>;
}) {
  const router = useRouter();
  const fechas = ultimosDias(hoy, DIAS_VISIBLES);

  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fechas.map((f) => [f, guardadas[f] != null ? String(guardadas[f]) : ""]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<number | null>(null);
  const [guardando, iniciar] = useTransition();

  // Solo viajan los días con número. Una casilla vacía significa "no lo sé",
  // y mandarla borraría lo que ya estuviera guardado para ese día.
  const aGuardar: DiaMetrica[] = fechas
    .filter((f) => valores[f]?.trim() !== "")
    .map((f) => ({ fecha: f, kcalTotales: Number(valores[f]) }))
    .filter((d) => Number.isFinite(d.kcalTotales!) && d.kcalTotales! > 0);

  const cambiados = aGuardar.filter(
    (d) => d.kcalTotales !== guardadas[d.fecha],
  ).length;

  function guardar() {
    setError(null);
    setHecho(null);
    iniciar(async () => {
      const r = await guardarDiasGarmin(aGuardar);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setHecho(r.guardados);
      router.refresh();
    });
  }

  return (
    <Tarjeta>
      <p className="text-sm text-ink-2">
        Si el informe de calorías no te deja exportar CSV, escribí acá el
        <strong> total del día</strong> que muestra Garmin —el de gasto, no el
        de las actividades sueltas—. Lo que dejes vacío no se toca.
      </p>

      <ul className="mt-3 divide-y divide-hairline-soft">
        {fechas.map((fecha) => {
          const esHoy = fecha === hoy;
          return (
            <li key={fecha} className="flex items-center gap-3 py-2">
              <label
                htmlFor={`kcal-${fecha}`}
                className="flex-1 text-sm text-ink-2"
              >
                <span className="font-mono tabular-nums">
                  {nombreDia(fecha)} {fecha.slice(8)}/{fecha.slice(5, 7)}
                </span>
                {esHoy && (
                  // Un día a medias deja un déficit que no fue: el reloj todavía
                  // no terminó de sumar.
                  <span className="ml-2 text-xs text-muted">
                    hoy — va a medias
                  </span>
                )}
              </label>
              <input
                id={`kcal-${fecha}`}
                type="number"
                min={0}
                max={20000}
                step={1}
                inputMode="numeric"
                placeholder="—"
                value={valores[fecha] ?? ""}
                onChange={(e) =>
                  setValores((p) => ({ ...p, [fecha]: e.target.value }))
                }
                className="w-24 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-right font-mono text-sm text-ink tabular-nums"
              />
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={guardar}
        disabled={guardando || aGuardar.length === 0}
        className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
      >
        {guardando
          ? "Guardando…"
          : aGuardar.length === 0
            ? "Escribí al menos un día"
            : `Guardar ${aGuardar.length} ${aGuardar.length === 1 ? "día" : "días"}${
                cambiados > 0 && cambiados < aGuardar.length
                  ? ` (${cambiados} con cambios)`
                  : ""
              }`}
      </button>

      {hecho !== null && (
        <div className="mt-3">
          <Aviso nivel="bien">
            Listo: {hecho} {hecho === 1 ? "día guardado" : "días guardados"}.
          </Aviso>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Aviso nivel="error">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
