"use client";

import { useRef } from "react";

/**
 * Tomar o elegir una foto con la cámara del propio teléfono.
 *
 * Abre la cámara nativa del sistema (un `<input type="file" capture>`) y no un
 * visor propio dentro de la app, y no es un detalle: un visor propio necesita
 * el permiso de cámara del navegador, y en el iPhone, con la app instalada, ese
 * permiso se vuelve a pedir una y otra vez —no hay forma de que se recuerde—.
 * La cámara nativa no pide permiso a la app: es el sistema quien la abre. Se
 * pierde ver el plato dentro de la pantalla mientras se encuadra; se gana que
 * no haya ni una ventana de "permitir" más.
 *
 * Son dos botones y no uno porque `capture` abre la cámara directo y no ofrece
 * la galería, y muchas comidas se fotografían en la mesa y se registran después.
 */
export function CapturaFoto({
  onFoto,
  titulo,
  ayuda,
  emoji = "📸",
}: {
  onFoto: (archivo: File) => void;
  titulo: string;
  ayuda?: string;
  emoji?: string;
}) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  // El `value` se limpia para poder elegir la misma foto dos veces seguidas;
  // sin esto el segundo intento no dispara `change`.
  const alElegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo) onFoto(archivo);
  };

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex aspect-[4/3] w-full max-w-sm flex-col items-center justify-center gap-3 rounded-[2rem] border border-dashed border-hairline bg-surface px-6">
        <span className="respira text-6xl" aria-hidden="true">
          {emoji}
        </span>
        <p className="font-serif text-xl text-ink">{titulo}</p>
        {ayuda && <p className="text-sm text-muted">{ayuda}</p>}
      </div>

      <button
        type="button"
        onClick={() => camara.current?.click()}
        className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-accent px-5 py-4 text-base font-semibold text-sobre-accent"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <path
            d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.6h6.6l1 1.6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="2" />
        </svg>
        Tomar foto
      </button>
      <button
        type="button"
        onClick={() => galeria.current?.click()}
        className="mx-auto block w-full max-w-sm rounded-full bg-hairline-soft px-5 py-3.5 text-base font-medium text-ink"
      >
        Elegir de la galería
      </button>

      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={alElegir}
        aria-label="Tomar una foto con la cámara"
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={alElegir}
        aria-label="Elegir una foto de la galería"
      />
    </div>
  );
}
