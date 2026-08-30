"use client";

import { useState } from "react";
import type { Alimento } from "@/lib/alimentos";
import { recalcularPorcion } from "@/lib/registro/porcion";
import type { ItemBorrador } from "@/lib/registro/tipos";

/** Un ítem del borrador con la clave que necesita React. */
export interface ItemEditable extends ItemBorrador {
  clave: string;
}

/**
 * La tarjeta editable de ítems.
 *
 * Es la misma venga del buscador manual o de la estimación de la IA — corregir
 * no es una excepción del flujo, es el flujo. La cuenta de qué pasa con los
 * macros al mover una porción vive en `lib/registro/porcion`, que es puro y
 * está testeado; acá solo queda la pantalla.
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
      items.map((item) =>
        item.clave === clave
          ? recalcularPorcion(
              item,
              nueva,
              item.foodId ? porId.get(item.foodId) : undefined,
            )
          : item,
      ),
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
                  <CampoPorcion
                    valor={porcion}
                    etiqueta={`Porción de ${item.alimento} en ${unidad}`}
                    onCambiar={(n) => cambiarPorcion(item.clave, n)}
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

/**
 * El número de la porción.
 *
 * Guarda lo que estás escribiendo como texto y no como número, que suena a
 * detalle y no lo es: con `value={numero}`, borrar el campo daba 0, el 0
 * quedaba escrito, y al teclear encima salía "030" —y una porción de cero
 * ponía los macros en cero de paso—. Con texto, el campo vacío es simplemente
 * "todavía no hay número": no se avisa a nadie hasta que lo haya.
 */
function CampoPorcion({
  valor,
  etiqueta,
  onCambiar,
}: {
  valor: number;
  etiqueta: string;
  onCambiar: (n: number) => void;
}) {
  const [texto, setTexto] = useState(() => String(valor));
  const [valorVisto, setValorVisto] = useState(valor);

  // Cuando el valor cambia desde afuera —al recuperar un borrador, o al
  // recalcular— el texto se pone al día. Es el patrón que React recomienda
  // para ajustar estado ante un cambio de props: durante el render, no en un
  // efecto, para que no haya un pintado intermedio con el número viejo.
  if (valor !== valorVisto) {
    setValorVisto(valor);
    setTexto(String(valor));
  }

  return (
    <input
      type="number"
      min={1}
      max={5000}
      step={5}
      inputMode="numeric"
      value={texto}
      onChange={(e) => {
        const crudo = e.target.value;
        setTexto(crudo);
        const n = Number(crudo);
        // Un campo vacío o un cero es "todavía no": no se avisa. Así se puede
        // borrar y volver a escribir sin que los macros pasen por cero.
        if (crudo.trim() !== "" && Number.isFinite(n) && n > 0) onCambiar(n);
      }}
      onBlur={() => setTexto(String(valor))}
      aria-label={etiqueta}
      className="w-24 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink tabular-nums outline-none focus:border-accent"
    />
  );
}
