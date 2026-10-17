"use client";

import { useState } from "react";
import { esCodigoValido } from "@/lib/barcode/openfoodfacts";
import { leerCodigoDeFoto } from "@/lib/barcode/leer-foto";
import { CapturaFoto } from "@/components/captura-foto";
import { claseControl } from "@/components/ui";

/**
 * Leer un código de barras: una foto del código, o escribir el número.
 *
 * Es una foto y no la cámara en vivo a propósito: la cámara en vivo pide
 * permiso al navegador una y otra vez en el iPhone, y la del sistema no. Para
 * que salga bien, la foto tiene que tener el código grande y con luz —se dice
 * en pantalla—; y si no sale, escribir el número, que está debajo de las barras,
 * siempre funciona.
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
      {leyendo ? (
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
