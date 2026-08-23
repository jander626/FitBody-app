"use client";

import { macrosDePorcion, type Alimento } from "@/lib/alimentos";
import type { ItemBorrador } from "@/lib/registro/tipos";

/** Un ítem del borrador con la clave que necesita React. */
export interface ItemEditable extends ItemBorrador {
  clave: string;
}

/**
 * La tarjeta editable de ítems.
 *
 * Es la misma venga del buscador manual o de la estimación de la IA — corregir
 * no es una excepción del flujo, es el flujo. Cuando el ítem está enlazado a
 * la tabla, mover la porción recalcula los macros desde ahí; cuando es texto
 * libre, se escala proporcionalmente sobre lo que estimó el modelo, que es lo
 * mejor disponible.
 */
export function EditorItems({
  items,
  alimentos,
  onCambiar,
}: {
  items: ItemEditable[];
  alimentos: Alimento[];
  onCambiar: (items: ItemEditable[]) => void;
}) {
  const porId = new Map(alimentos.map((a) => [a.id, a]));

  function cambiarPorcion(clave: string, nueva: number) {
    onCambiar(
      items.map((item) => {
        if (item.clave !== clave) return item;

        const enTabla = item.foodId ? porId.get(item.foodId) : undefined;
        if (enTabla) {
          return {
            ...item,
            porcionG: nueva,
            ...macrosDePorcion(enTabla, nueva),
          };
        }

        // Texto libre: se escala sobre la estimación original. Sin porción
        // previa no hay proporción que aplicar, así que solo se anota.
        const anterior = item.porcionG ?? item.porcionMl;
        if (!anterior || anterior <= 0) {
          return { ...item, porcionG: nueva };
        }
        const factor = nueva / anterior;
        const campo = item.porcionMl !== null ? "porcionMl" : "porcionG";
        return {
          ...item,
          [campo]: nueva,
          kcal: Math.round(item.kcal * factor * 10) / 10,
          proteinaG: Math.round(item.proteinaG * factor * 10) / 10,
          carbsG: Math.round(item.carbsG * factor * 10) / 10,
          grasaG: Math.round(item.grasaG * factor * 10) / 10,
        };
      }),
    );
  }

  function quitar(clave: string) {
    onCambiar(items.filter((i) => i.clave !== clave));
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const unidad = item.porcionMl !== null ? "ml" : "g";
        const porcion = item.porcionMl ?? item.porcionG;

        return (
          <div key={item.clave}>
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-sm text-ink">{item.alimento}</span>
              <button
                type="button"
                onClick={() => quitar(item.clave)}
                aria-label={`Quitar ${item.alimento}`}
                className="shrink-0 text-xs text-muted underline underline-offset-4"
              >
                Quitar
              </button>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              {porcion !== null ? (
                <>
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    step={5}
                    inputMode="numeric"
                    value={porcion}
                    onChange={(e) =>
                      cambiarPorcion(item.clave, Number(e.target.value) || 0)
                    }
                    aria-label={`Porción de ${item.alimento} en ${unidad}`}
                    className="w-24 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink tabular-nums outline-none focus:border-accent"
                  />
                  <span className="text-xs text-muted">{unidad}</span>
                </>
              ) : (
                // Sin porción: la cantidad va en el nombre ("3 huevos") o no
                // significa nada ("agua"). Inventar un número sería peor.
                <span className="text-xs text-muted">sin porción</span>
              )}

              <span className="ml-auto font-mono text-xs text-muted tabular-nums">
                {Math.round(item.kcal)} kcal · {Math.round(item.proteinaG)}P{" "}
                {Math.round(item.carbsG)}C {Math.round(item.grasaG)}G
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
