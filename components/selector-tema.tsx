"use client";

import { useSyncExternalStore } from "react";
import { aplicarTema, TEMAS, temaGuardado, guardarTema, type Tema } from "@/lib/tema";

/**
 * Elegir el tema.
 *
 * Tres opciones y no un interruptor de dos, porque "seguí al teléfono" es una
 * respuesta legítima y distinta de "siempre claro". Un interruptor obligaría a
 * elegir un bando y perdería la opción que la mayoría quiere.
 *
 * El tema vive fuera de React —en localStorage y en un atributo del html— así
 * que se lee con useSyncExternalStore y no con estado propio. Es lo que hace
 * que el servidor pueda renderizar "Automático" y el cliente corrija al
 * hidratar sin que React se queje, y que dos selectores en pantalla (o una
 * pestaña vecina) no se contradigan.
 */

const ETIQUETA: Record<Tema, string> = {
  auto: "Automático",
  claro: "Claro",
  oscuro: "Oscuro",
};

/** El evento con el que un cambio se propaga a quien esté mirando. */
const EVENTO = "fitfood:tema";

function suscribir(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO, alCambiar);
  // `storage` avisa de los cambios hechos en OTRA pestaña. Sin esto, cambiar
  // el tema en una deja a la otra mostrando el botón equivocado.
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** En el servidor no hay almacenamiento: automático es lo que trae la app. */
const enServidor = (): Tema => "auto";

export function SelectorTema() {
  const tema = useSyncExternalStore(suscribir, temaGuardado, enServidor);

  function elegir(nuevo: Tema) {
    guardarTema(nuevo);
    aplicarTema(nuevo);
    window.dispatchEvent(new Event(EVENTO));
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Tema de la app"
        className="flex gap-1 rounded-xl bg-hairline-soft p-1"
      >
        {TEMAS.map((opcion) => {
          const activo = tema === opcion;
          return (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => elegir(opcion)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                activo ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              {ETIQUETA[opcion]}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        En automático sigue lo que tengas puesto en el teléfono.
      </p>
    </div>
  );
}
