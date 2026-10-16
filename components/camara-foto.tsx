"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Visor de cámara en vivo para fotografiar la comida.
 *
 * Reemplaza el "Tomar o elegir una foto" que abría el selector del sistema:
 * ver el plato en el visor y tocar el obturador es el gesto que la gente ya
 * conoce, y se siente como escanear en vez de rellenar un formulario. La
 * galería sigue a un toque, porque muchas comidas se fotografían en la mesa y
 * se registran después.
 *
 * La cámara solo está encendida mientras este componente está montado: al
 * cambiar de modo se apaga, para no dejar la luz verde puesta ni gastar batería.
 */
export function CamaraFoto({ onFoto }: { onFoto: (archivo: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  const [destello, setDestello] = useState(0);

  useEffect(() => {
    let parar: (() => void) | null = null;
    let cancelado = false;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAviso("Este navegador no deja usar la cámara. Elige una foto de la galería.");
        return;
      }
      try {
        const flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 } },
          audio: false,
        });
        if (cancelado) {
          flujo.getTracks().forEach((t) => t.stop());
          return;
        }
        const el = video.current;
        if (el) {
          el.srcObject = flujo;
          await el.play().catch(() => {});
          setLista(true);
        }
        parar = () => flujo.getTracks().forEach((t) => t.stop());
      } catch {
        if (!cancelado) {
          setAviso("No pude abrir la cámara. Revisa el permiso del navegador o elige una foto de la galería.");
        }
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      parar?.();
    };
  }, []);

  function capturar() {
    const el = video.current;
    if (!el || el.videoWidth === 0) return;

    const lienzo = document.createElement("canvas");
    lienzo.width = el.videoWidth;
    lienzo.height = el.videoHeight;
    lienzo.getContext("2d")?.drawImage(el, 0, 0);

    setDestello((n) => n + 1);
    lienzo.toBlob(
      (blob) => {
        if (blob) onFoto(new File([blob], "comida.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-center font-serif text-xl text-ink">Toma una foto de tu comida</p>

      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[2rem] bg-black">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />

        {/* Las esquinas del visor: el marco que dice "apunta aquí". */}
        <span className="pointer-events-none absolute inset-4 rounded-[1.5rem] border-2 border-white/70" aria-hidden="true" />

        {!lista && !aviso && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Abriendo la cámara…
          </span>
        )}
        {destello > 0 && (
          <span
            key={destello}
            className="pointer-events-none absolute inset-0 bg-white"
            style={{ animation: "destello 260ms ease-out both" }}
            aria-hidden="true"
          />
        )}
      </div>

      {aviso && <p className="text-center text-sm text-ink-2">{aviso}</p>}

      <div className="flex items-center justify-center gap-10">
        <span className="size-12" aria-hidden="true" />
        <button
          type="button"
          onClick={capturar}
          disabled={!lista}
          aria-label="Tomar la foto"
          className="flex size-20 items-center justify-center rounded-full border-4 border-accent bg-surface disabled:opacity-40"
        >
          <span className="size-14 rounded-full bg-accent" />
        </button>
        <button
          type="button"
          onClick={() => galeria.current?.click()}
          aria-label="Elegir de la galería"
          className="flex size-12 items-center justify-center rounded-full border border-hairline bg-surface text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="2" />
            <circle cx="9" cy="10" r="1.6" fill="currentColor" />
            <path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <input
        ref={galeria}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onFoto(archivo);
        }}
      />
    </div>
  );
}
