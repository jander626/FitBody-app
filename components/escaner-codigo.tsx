"use client";

import { useEffect, useRef, useState } from "react";
import { esCodigoValido } from "@/lib/barcode/openfoodfacts";
import { claseControl } from "@/components/ui";

/**
 * Lector de códigos de barras con la cámara.
 *
 * Usa ZXing en vez de `BarcodeDetector` porque Safari en iPhone no lo tiene, y
 * ahí es donde más se va a usar. La librería se carga solo al abrir el lector,
 * para no sumar peso a quien nunca escanea.
 *
 * Siempre hay una salida sin cámara —escribir el número—: el permiso puede
 * estar negado, o el código puede estar rayado o muy chico para el lente.
 */
export function EscanerCodigo({
  onCodigo,
  onCerrar,
}: {
  onCodigo: (codigo: string) => void;
  onCerrar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  // Los callbacks cambian en cada render del padre; el efecto solo debe correr
  // una vez, o la cámara se reiniciaría a cada tecla.
  const alCodigo = useRef(onCodigo);
  useEffect(() => {
    alCodigo.current = onCodigo;
  });

  useEffect(() => {
    let detener: (() => void) | null = null;
    let cancelado = false;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAviso("Este navegador no deja usar la cámara. Escribí el número abajo.");
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
          await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (cancelado || !video.current) return;

        const pistas = new Map();
        pistas.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);

        const lector = new BrowserMultiFormatReader(pistas);
        const controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (resultado) => {
            const codigo = resultado?.getText();
            if (codigo && esCodigoValido(codigo)) {
              controles?.stop();
              alCodigo.current(codigo);
            }
          },
        );
        if (cancelado) controles.stop();
        else detener = () => controles.stop();
      } catch {
        if (!cancelado) {
          setAviso(
            "No pude abrir la cámara. Revisá el permiso del navegador o escribí el número abajo.",
          );
        }
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      detener?.();
    };
  }, []);

  function enviarManual() {
    const codigo = manual.replace(/\s/g, "");
    if (!esCodigoValido(codigo)) {
      setAviso("Ese número no parece un código de barras (8, 12, 13 o 14 dígitos).");
      return;
    }
    onCodigo(codigo);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-black">
        <video
          ref={video}
          playsInline
          muted
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      <p className="text-xs text-muted">
        Apuntá al código de barras del empaque, con buena luz y sin acercar
        demasiado.
      </p>

      {aviso && <p className="text-sm text-ink-2">{aviso}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="O escribí el número"
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
