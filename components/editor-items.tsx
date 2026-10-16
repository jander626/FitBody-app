"use client";

import { useState } from "react";
import type { Alimento } from "@/lib/alimentos";
import { emojiDeAlimento } from "@/lib/registro/presentacion";
import { recalcularPorcion } from "@/lib/registro/porcion";
import type { ItemBorrador } from "@/lib/registro/tipos";
import { SelectorNumero } from "./selector-numero";

/** Un ítem del borrador con la clave que necesita React. */
export interface ItemEditable extends ItemBorrador {
  clave: string;
}

/**
 * La lista de ingredientes de una comida.
 *
 * Es la misma venga del buscador, de la estimación de la IA o de corregir una
 * comida ya guardada — corregir no es una excepción del flujo, es el flujo. La
 * cuenta de qué pasa con los macros al mover una porción vive en
 * `lib/registro/porcion`, que es puro y está testeado; acá solo queda la
 * pantalla.
 *
 * Cada fila muestra lo esencial (ícono, nombre, cantidad, calorías). Tocarla
 * abre el ajuste con un deslizador, y los totales de arriba se mueven en vivo:
 * ver cómo cambia la comida mientras arrastras es lo que hace que corregir una
 * porción se sienta como un gesto y no como llenar un formulario.
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
  // Solo una fila abierta a la vez: dos deslizadores a la vez no caben en
  // una pantalla de celular.
  const [abierta, setAbierta] = useState<string | null>(null);

  function cambiarPorcion(clave: string, nueva: number) {
    onCambiar(
      items.map((item) =>
        item.clave === clave
          ? recalcularPorcion(item, nueva, item.foodId ? porId.get(item.foodId) : undefined)
          : item,
      ),
    );
  }

  function quitar(clave: string) {
    onCambiar(items.filter((i) => i.clave !== clave));
    setAbierta(null);
  }

  return (
    <ul className="divide-y divide-hairline-soft">
      {items.map((item, i) => {
        const unidad = item.porcionMl !== null ? "ml" : "g";
        const porcion = item.porcionMl ?? item.porcionG;
        const abierto = abierta === item.clave;

        return (
          <li key={item.clave} className="entra py-1" style={{ "--i": i } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => setAbierta(abierto ? null : item.clave)}
              aria-expanded={abierto}
              aria-label={`${item.alimento}: ${porcion !== null ? `${porcion} ${unidad}, ` : ""}${Math.round(item.kcal)} kcal. Tocar para ajustar`}
              className="flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span className="text-2xl" aria-hidden="true">
                {emojiDeAlimento(item.alimento)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{item.alimento}</span>
                <span className="block text-xs text-muted">
                  {porcion !== null ? `${Math.round(porcion)} ${unidad}` : "sin porción"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm text-ink tabular-nums">{Math.round(item.kcal)} kcal</span>
                <span className="block font-mono text-[11px] text-muted tabular-nums">
                  {Math.round(item.proteinaG)}P {Math.round(item.carbsG)}C {Math.round(item.grasaG)}G
                </span>
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`size-4 shrink-0 text-muted transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
                fill="none"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {abierto && (
              <div className="entra rounded-2xl bg-hairline-soft px-4 py-4">
                {porcion !== null ? (
                  <SelectorNumero
                    compacto
                    etiqueta={`porción de ${item.alimento}`}
                    unidad={unidad}
                    valor={porcion}
                    min={5}
                    max={Math.max(600, Math.round(porcion * 3))}
                    paso={5}
                    onCambiar={(n) => cambiarPorcion(item.clave, n)}
                  />
                ) : (
                  // Sin porción: la cantidad va en el nombre ("3 huevos") o no
                  // significa nada ("agua"). Inventar un número sería peor.
                  <p className="text-sm text-muted">
                    Este ítem no tiene porción: la cantidad está en el nombre.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => quitar(item.clave)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium text-bad"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Quitar de la comida
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
