"use client";

import { useRef } from "react";

/**
 * Una foto que se abre a pantalla completa al tocarla.
 *
 * Las tres fotos de la app tienen el mismo problema: son chicas por buenas
 * razones —la miniatura del diario tiene que dejar leer la comida al lado, y
 * la previa de registrar no puede empujar el botón de estimar fuera de la
 * pantalla— pero a veces uno necesita mirar el plato de cerca para decidir si
 * eran 150 g de pollo o 200. Esto resuelve las dos cosas sin elegir una.
 *
 * Va sobre `<dialog>` y `showModal()` en vez de un div con `position: fixed`
 * porque el navegador ya sabe hacer esto bien: lo pone en la capa superior
 * —encima de todo, sin pelear con z-index ni con la barra de navegación—,
 * cierra con Escape, atrapa el foco adentro y vuelve a dejarlo donde estaba al
 * salir. Nada de eso sale gratis si se hace a mano.
 */
export function FotoAmpliable({
  src,
  alt,
  etiqueta,
  className,
  loading,
}: {
  src: string;
  /** Vacío cuando al lado ya se dice qué comida es: la imagen decora. */
  alt: string;
  /** Lo que se lee del botón. La imagen decorativa no da nombre accesible. */
  etiqueta: string;
  /** Cómo se ve la miniatura. La foto abierta no lo usa. */
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  function abrir() {
    dialogo.current?.showModal();
    // Safari en iOS deja seguir arrastrando la página por detrás del diálogo,
    // así que al cerrar uno aparece en otra parte del diario.
    document.body.style.overflow = "hidden";
  }

  // Sirve para el botón de cerrar, para el toque en cualquier parte y para
  // Escape: los tres terminan disparando `close`.
  function alCerrar() {
    document.body.style.overflow = "";
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={etiqueta}
        className="block cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading={loading} className={className} />
      </button>

      <dialog
        ref={dialogo}
        onClose={alCerrar}
        // Tocar en cualquier parte cierra. Es lo que uno intenta primero, y
        // acá no hay nada más que hacer que mirar y salir.
        onClick={() => dialogo.current?.close()}
        // Negro y no un token del tema: una foto se juzga mejor sobre fondo
        // oscuro, en modo claro y en oscuro por igual. Casi opaco a propósito
        // —lo que se vea de la pantalla de atrás compite con el plato.
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 backdrop:bg-black/95"
      >
        <div className="flex h-full w-full items-center justify-center p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        {/*
          El botón de cerrar es redundante con tocar la foto, y va igual: sin
          nada visible, quien no adivina el gesto queda encerrado mirando la
          imagen. Se corre por debajo de la muesca del iPhone.
        */}
        <button
          type="button"
          onClick={() => dialogo.current?.close()}
          aria-label="Cerrar la foto"
          className="absolute right-3 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur-sm"
          style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          Cerrar
        </button>
      </dialog>
    </>
  );
}
