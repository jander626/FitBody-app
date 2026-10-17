"use client";

import { useEffect, useRef, useState } from "react";
import { abrirCamara, camaraLista } from "@/lib/barcode/camara-sesion";
import { esCodigoValido } from "@/lib/barcode/openfoodfacts";
import { leerCodigoDeFoto } from "@/lib/barcode/leer-foto";
import { CapturaFoto } from "@/components/captura-foto";
import { claseControl } from "@/components/ui";

/**
 * Leer un código de barras: una foto del código, escribir el número, o —si se
 * pide— apuntar la cámara en vivo.
 *
 * Lo normal es la foto: la cámara del sistema nunca pide permiso. El modo en
 * vivo es opcional y pide permiso una sola vez por apertura de la app
 * (`camara-sesion`); si no se toca, nunca se pide. Escribir el número, que está
 * debajo de las barras, siempre funciona.
 */
export function EscanerCodigo({
  onCodigo,
  onCerrar,
}: {
  onCodigo: (codigo: string) => void;
  onCerrar: () => void;
}) {
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [enVivo, setEnVivo] = useState(false);

  async function alFoto(archivo: File) {
    setAviso(null);
    setLeyendo(true);
    try {
      const codigo = await leerCodigoDeFoto(archivo);
      if (codigo) {
        onCodigo(codigo);
        return;
      }
      setAviso(
        "No pude leer el código en esa foto. Acércate hasta que las barras ocupen buena parte de la imagen, con buena luz y sin reflejos, o escribe el número de abajo.",
      );
    } catch {
      setAviso("No pude procesar la foto. Intenta de nuevo o escribe el número de abajo.");
    } finally {
      setLeyendo(false);
    }
  }

  function enviarManual() {
    const codigo = manual.replace(/\s/g, "");
    if (!esCodigoValido(codigo)) {
      setAviso("Ese número no parece un código de barras (8, 12, 13 o 14 dígitos).");
      return;
    }
    onCodigo(codigo);
  }

  return (
    <div className="space-y-4">
      {enVivo ? (
        <VisorEnVivo
          onCodigo={onCodigo}
          onFallo={(m) => {
            setEnVivo(false);
            setAviso(m);
          }}
          onSalir={() => setEnVivo(false)}
        />
      ) : leyendo ? (
        <p className="py-10 text-center text-sm text-ink-2" aria-live="polite">
          Buscando el código en la foto…
        </p>
      ) : (
        <CapturaFoto
          emoji="▌▌▎▌"
          titulo="Fotografía el código de barras"
          ayuda="Que las barras se vean grandes y nítidas, con buena luz."
          onFoto={alFoto}
        />
      )}

      {!enVivo && !leyendo && (
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            setEnVivo(true);
          }}
          className="w-full rounded-full bg-hairline-soft px-5 py-3 text-sm font-medium text-ink"
        >
          Escanear en vivo
          <span className="block text-xs font-normal text-muted">
            {camaraLista() ? "Usa la cámara que ya permitiste" : "Pide permiso de cámara una vez"}
          </span>
        </button>
      )}

      {aviso && <p className="text-sm text-ink-2">{aviso}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="O escribe el número"
          aria-label="Número del código de barras"
          className={`${claseControl} mt-0 flex-1`}
        />
        <button
          type="button"
          onClick={enviarManual}
          className="shrink-0 rounded-xl border border-hairline px-4 text-sm text-ink"
        >
          Buscar
        </button>
      </div>

      <button type="button" onClick={onCerrar} className="text-sm text-muted underline">
        Cerrar
      </button>
    </div>
  );
}

function VisorEnVivo({
  onCodigo,
  onFallo,
  onSalir,
}: {
  onCodigo: (codigo: string) => void;
  onFallo: (mensaje: string) => void;
  onSalir: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  // Los callbacks cambian en cada render del padre; el efecto corre una vez.
  const callbacks = useRef({ onCodigo, onFallo });
  useEffect(() => {
    callbacks.current = { onCodigo, onFallo };
  });

  useEffect(() => {
    let cancelado = false;
    let flujo: MediaStream | null = null;
    let controles: { stop: () => void } | null = null;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        callbacks.current.onFallo("Este navegador no deja usar la cámara en vivo. Usa la foto o escribe el número.");
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }, f] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
          abrirCamara(),
        ]);
        flujo = f;
        if (cancelado || !video.current) {
          f.getTracks().forEach((t) => t.stop());
          return;
        }
        const pistas = new Map();
        pistas.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        const lector = new BrowserMultiFormatReader(pistas);
        controles = await lector.decodeFromStream(f, video.current, (resultado) => {
          const codigo = resultado?.getText();
          if (codigo && esCodigoValido(codigo)) {
            controles?.stop();
            callbacks.current.onCodigo(codigo);
          }
        });
        if (cancelado) controles.stop();
      } catch {
        if (!cancelado) {
          callbacks.current.onFallo(
            "No pude abrir la cámara. Revisa el permiso del navegador, o usa la foto o escribe el número.",
          );
        }
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      controles?.stop();
      // Solo se detiene el clon: el flujo base sigue vivo (apagado) para no
      // volver a pedir permiso.
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl bg-black">
        <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
      </div>
      <p className="text-xs text-muted">Apunta al código de barras, con buena luz y sin acercar demasiado.</p>
      <button type="button" onClick={onSalir} className="text-sm text-muted underline">
        Dejar de escanear
      </button>
    </div>
  );
}
