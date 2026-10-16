"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/ui";
import { claseControl } from "@/components/ui";
import { macrosDePorcion } from "@/lib/alimentos";
import type { ProductoEscaneado, ResultadoProducto } from "@/lib/barcode/openfoodfacts";

type Estado =
  | { fase: "buscando" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; resultado: ResultadoProducto };

/**
 * Qué pasó con un código: busca el producto y deja elegir la porción.
 *
 * Los macros salen de multiplicar los valores por 100 g por los gramos, igual
 * que con la tabla: acá tampoco se estima nada.
 */
export function ProductoEscaneadoCard({
  codigo,
  onAgregar,
  onCancelar,
}: {
  codigo: string;
  onAgregar: (producto: ProductoEscaneado, gramos: number) => void;
  onCancelar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "buscando" });
  const [gramos, setGramos] = useState("");

  useEffect(() => {
    const control = new AbortController();
    fetch(`/api/codigo-barras?codigo=${encodeURIComponent(codigo)}`, {
      signal: control.signal,
    })
      .then(async (r) => {
        const cuerpo = await r.json();
        if (!r.ok) throw new Error(cuerpo?.error ?? "No se pudo buscar.");
        const resultado = cuerpo as ResultadoProducto;
        if (resultado.estado === "ok") {
          setGramos(String(resultado.producto.porcionG ?? 100));
        }
        setEstado({ fase: "listo", resultado });
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setEstado({
          fase: "error",
          mensaje: e instanceof Error ? e.message : "No se pudo buscar.",
        });
      });
    return () => control.abort();
  }, [codigo]);

  if (estado.fase === "buscando") {
    return <p className="text-sm text-muted">Buscando {codigo}…</p>;
  }

  if (estado.fase === "error") {
    return (
      <div className="space-y-3">
        <Aviso nivel="error">{estado.mensaje}</Aviso>
        <button type="button" onClick={onCancelar} className="text-sm text-muted underline">
          Volver
        </button>
      </div>
    );
  }

  const { resultado } = estado;

  if (resultado.estado !== "ok") {
    return (
      <div className="space-y-3">
        <Aviso nivel="info">
          {resultado.estado === "no_encontrado"
            ? "No encontré ese producto. "
            : `${resultado.nombre ?? "Ese producto"} está en la base pero sin su tabla nutricional. `}
          Registralo por foto o por texto y queda estimado.
        </Aviso>
        <button type="button" onClick={onCancelar} className="text-sm text-muted underline">
          Volver
        </button>
      </div>
    );
  }

  const { producto } = resultado;
  const g = Number(gramos);
  const valido = Number.isFinite(g) && g > 0 && g <= 10000;
  const macros = valido ? macrosDePorcion(producto, g) : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink">{producto.nombre}</p>
        <p className="text-xs text-muted">
          {producto.marca ? `${producto.marca} · ` : ""}
          {producto.kcal100} kcal · {producto.p100}P {producto.c100}C {producto.g100}G por 100
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink-2">Cantidad (g o ml)</span>
        <input
          type="number"
          inputMode="decimal"
          value={gramos}
          onChange={(e) => setGramos(e.target.value)}
          className={claseControl}
        />
      </label>

      {macros && (
        <p className="font-mono text-sm text-ink tabular-nums">
          {Math.round(macros.kcal)} kcal
          <span className="text-muted">
            {" · "}
            {Math.round(macros.proteinaG)}P {Math.round(macros.carbsG)}C{" "}
            {Math.round(macros.grasaG)}G
          </span>
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={!valido}
          onClick={() => onAgregar(producto, g)}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
        >
          Agregar
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-muted underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
