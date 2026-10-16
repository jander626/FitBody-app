"use client";

import type { Totales } from "@/lib/registro/tipos";

/**
 * Cómo queda el día con esta comida.
 *
 * Una barra con lo que ya llevas, lo que suma esta comida (más claro) y lo que
 * te sobra o te pasas. Es la versión viva de "cómo encaja": en vez de una frase,
 * se ve el espacio que ocupa. Sin objetivo no hay contra qué medir y no se muestra.
 */
export function TuDia({
  consumido,
  esta,
  objetivo,
}: {
  consumido: Totales;
  esta: Totales;
  objetivo: Totales | null;
}) {
  if (!objetivo || objetivo.kcal <= 0) return null;

  const total = consumido.kcal + esta.kcal;
  const restante = objetivo.kcal - total;
  const pasado = restante < 0;

  const pct = (kcal: number) => Math.min(100, Math.max(0, (kcal / objetivo.kcal) * 100));
  const antes = pct(consumido.kcal);
  // Lo que suma esta comida, acotado a lo que cabe: pasarse se dice con texto y color.
  const suma = Math.min(pct(total) - antes, 100 - antes);

  return (
    <div className="rounded-3xl border border-hairline bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-ink">Tu día con esta comida</p>
        <p className="font-mono text-xs text-muted tabular-nums">
          {Math.round(total).toLocaleString("es-CO")} / {objetivo.kcal.toLocaleString("es-CO")} kcal
        </p>
      </div>

      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-hairline-soft"
        role="meter"
        aria-valuenow={Math.round(total)}
        aria-valuemin={0}
        aria-valuemax={objetivo.kcal}
        aria-label={`Calorías del día con esta comida: ${Math.round(total)} de ${objetivo.kcal}`}
      >
        <span
          className="h-full transition-[width] duration-300"
          style={{ width: `${antes}%`, background: pasado ? "var(--bad)" : "var(--accent)" }}
        />
        <span
          className="h-full transition-[width] duration-300"
          style={{
            width: `${suma}%`,
            background: pasado ? "var(--bad)" : "var(--accent)",
            opacity: 0.45,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" /> Ya llevas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent opacity-45" aria-hidden="true" /> Esta comida
          </span>
        </span>
        <span className={`font-medium ${pasado ? "text-bad" : "text-ink-2"}`}>
          {pasado
            ? `Te pasas ${Math.round(-restante).toLocaleString("es-CO")} kcal`
            : `Te quedan ${Math.round(restante).toLocaleString("es-CO")} kcal`}
        </span>
      </div>
    </div>
  );
}
