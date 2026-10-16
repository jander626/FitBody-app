"use client";

import { createPortal } from "react-dom";
import { useHidratado } from "./hidratado";
import { MOMENTOS, NOMBRE_MOMENTO } from "@/lib/registro/tipos";

/**
 * La barra de acción de una comida armada: dónde va y el botón de guardar.
 *
 * Va fija abajo, a la vista de todo lo que se esté revisando: cuando la comida
 * es larga, el botón de guardar no puede quedar tres pantallas más abajo. La
 * comida se elige con pastillas (un toque) y no con un menú desplegable, y el
 * botón dice cuánto suma, que es lo último que uno mira antes de confirmar.
 *
 * Va en un portal, igual que la barra de modos: un `position: fixed` dentro de
 * un elemento animado se pega a ese elemento en WebKit y no a la pantalla.
 */
export function BarraGuardar({
  activa,
  momento,
  onMomento,
  kcal,
  guardando,
  deshabilitado,
  onGuardar,
  onDescartar,
}: {
  /** Solo la muestra el modo que está a la vista: los demás siguen montados. */
  activa: boolean;
  momento: (typeof MOMENTOS)[number];
  onMomento: (m: (typeof MOMENTOS)[number]) => void;
  kcal: number;
  guardando: boolean;
  deshabilitado: boolean;
  onGuardar: () => void;
  onDescartar?: () => void;
}) {
  const hidratado = useHidratado();
  if (!activa) return null;

  return (
    <>
      {/* El hueco que ocupa la barra, para que lo último de la pantalla no
          quede tapado. */}
      <div className="h-36" aria-hidden="true" />
      {hidratado &&
        createPortal(
          <div
            className="fixed inset-x-0 z-20 mx-auto max-w-md px-3"
            style={{ bottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="pop rounded-[2rem] border border-hairline bg-surface/95 p-3 shadow-[var(--shadow)] backdrop-blur-md">
              <div role="radiogroup" aria-label="Comida" className="flex gap-2 overflow-x-auto pb-2.5">
                {MOMENTOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={momento === m}
                    onClick={() => onMomento(m)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
                      momento === m ? "bg-accent text-sobre-accent" : "bg-hairline-soft text-ink-2"
                    }`}
                  >
                    {NOMBRE_MOMENTO[m]}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {onDescartar && (
                  <button
                    type="button"
                    onClick={onDescartar}
                    aria-label="Descartar y empezar de nuevo"
                    className="flex size-14 shrink-0 items-center justify-center rounded-full bg-hairline-soft text-ink-2"
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGuardar}
                  disabled={guardando || deshabilitado}
                  className="flex-1 rounded-full bg-accent px-5 py-4 text-base font-semibold text-sobre-accent disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : `Guardar · ${Math.round(kcal)} kcal`}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
