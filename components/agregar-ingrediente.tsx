"use client";

import { useMemo, useRef, useState } from "react";
import { buscarAlimentos, type Alimento } from "@/lib/alimentos";
import { emojiDeAlimento } from "@/lib/registro/presentacion";

/**
 * "Agregar ingrediente": una hoja que sube desde abajo con un buscador.
 *
 * Es el gesto que faltaba al corregir una comida: la IA se olvida de la salsa
 * o del aceite, y agregarlos no debería obligar a salir de la pantalla ni a
 * perder lo que ya se ajustó. La hoja se abre encima, se busca, se toca, y el
 * ingrediente aparece en la lista con sus macros ya calculados.
 *
 * Va sobre `<dialog>` y `showModal()` por lo mismo que la foto ampliable: el
 * navegador se encarga de tapar lo de atrás, de atrapar el foco y de cerrar
 * con Escape.
 */
export function AgregarIngrediente({
  alimentos,
  onAgregar,
}: {
  alimentos: Alimento[];
  onAgregar: (alimento: Alimento) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [consulta, setConsulta] = useState("");

  const resultados = useMemo(() => buscarAlimentos(alimentos, consulta, 40), [alimentos, consulta]);

  function abrir() {
    dialogo.current?.showModal();
    // Igual que la foto: iOS deja arrastrar la página por detrás del diálogo.
    document.body.style.overflow = "hidden";
  }
  function alCerrar() {
    document.body.style.overflow = "";
    setConsulta("");
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-hairline py-3 text-sm font-medium text-accent"
      >
        <span className="text-lg leading-none">+</span> Agregar ingrediente
      </button>

      <dialog
        ref={dialogo}
        onClose={alCerrar}
        // Tocar el fondo oscuro cierra; tocar dentro de la hoja no.
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto h-[85dvh] max-h-none w-full max-w-md rounded-t-[2rem] border-0 bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-5 pb-3 pt-5">
            <h2 className="flex-1 font-serif text-xl">Agregar ingrediente</h2>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              aria-label="Cerrar"
              className="flex size-10 items-center justify-center rounded-full bg-hairline-soft text-ink"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-5 pb-3">
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="arepa, pollo, chicharrón…"
              aria-label="Buscar un alimento para agregar"
              className="w-full rounded-2xl border border-hairline bg-ground px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-accent"
            />
            {consulta.trim() === "" && (
              <p className="mt-2 px-1 text-xs text-muted">De más a menos proteína por 100 g.</p>
            )}
          </div>

          <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-8">
            {resultados.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAgregar(a);
                    dialogo.current?.close();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {emojiDeAlimento(a.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{a.nombre}</span>
                    <span className="block text-xs text-muted">
                      {a.kcal100} kcal · {a.p100}P {a.c100}C {a.g100}G por 100 g
                    </span>
                  </span>
                  <span className="shrink-0 text-xl text-accent" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
            {resultados.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">
                Nada con «{consulta}» en la tabla. Descríbelo en <strong>Texto</strong> o escanéalo en{" "}
                <strong>Código</strong> y queda estimado.
              </li>
            )}
          </ul>
        </div>
      </dialog>
    </>
  );
}
