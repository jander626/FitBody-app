"use client";

import { useEffect, useMemo, useState } from "react";
import { Aviso, claseControl } from "@/components/ui";
import { CapturaFoto } from "@/components/captura-foto";
import { ProgresoEstimacion } from "@/components/progreso-estimacion";
import { SelectorNumero } from "@/components/selector-numero";
import { macrosDePorcion } from "@/lib/alimentos";
import {
  aPor100,
  estaCompleta,
  revisarPor100,
  type Base,
  type Lectura,
} from "@/lib/barcode/etiqueta";
import type { ProductoEscaneado, ResultadoProducto } from "@/lib/barcode/openfoodfacts";
import { comprimirFoto } from "@/lib/foto";
import { guardarProducto } from "@/app/(app)/registrar/productos";

type Fase =
  | { t: "buscando" }
  | { t: "error"; mensaje: string }
  | { t: "encontrado"; producto: ProductoEscaneado; guardado: boolean }
  | { t: "sin_datos"; nombre: string | null; sinTabla: boolean }
  | { t: "foto"; nombre: string | null }
  | { t: "leyendo"; foto: string }
  | { t: "formulario"; lectura: Lectura | null; aviso: string | null; nombre: string };

const ETAPAS_ETIQUETA = ["Mirando la etiqueta", "Leyendo los valores", "Pasándolos a 100 g"];

/**
 * Lo que pasa después de leer un código de barras.
 *
 * Tres caminos, del mejor al peor:
 *  1. El producto ya está (en tu tabla o en Open Food Facts): se elige la
 *     cantidad y se agrega.
 *  2. No está, o está sin su tabla nutricional: se le toma foto a la etiqueta,
 *     el modelo la lee, se revisa y se guarda. Es lo que hace crecer la base:
 *     la próxima vez que se escanee ese código, sale solo.
 *  3. La foto no sirve o no hay IA: se escriben los valores a mano, con el mismo
 *     formulario.
 *
 * Los macros siempre salen de multiplicar los valores por 100 g por los gramos.
 * Acá nunca se estima nada.
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
  const [fase, setFase] = useState<Fase>({ t: "buscando" });

  useEffect(() => {
    const control = new AbortController();
    fetch(`/api/codigo-barras?codigo=${encodeURIComponent(codigo)}`, { signal: control.signal })
      .then(async (r) => {
        const cuerpo = await r.json();
        if (!r.ok) throw new Error(cuerpo?.error ?? "No se pudo buscar.");
        const res = cuerpo as ResultadoProducto;
        if (res.estado === "ok") {
          setFase({ t: "encontrado", producto: res.producto, guardado: res.origen === "propio" });
        } else if (res.estado === "sin_nutricion") {
          setFase({ t: "sin_datos", nombre: res.nombre, sinTabla: true });
        } else {
          setFase({ t: "sin_datos", nombre: null, sinTabla: false });
        }
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setFase({ t: "error", mensaje: e instanceof Error ? e.message : "No se pudo buscar." });
      });
    return () => control.abort();
  }, [codigo]);

  async function alFotoEtiqueta(archivo: File, nombre: string | null) {
    try {
      // Más lado que una foto de comida: aquí el modelo tiene que leer letra chica.
      const foto = await comprimirFoto(archivo, { lado: 1800, calidad: 0.85 });
      setFase({ t: "leyendo", foto: foto.base64 });

      const r = await fetch("/api/etiqueta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fotoBase64: foto.base64, fotoMediaType: "image/jpeg" }),
      });
      const cuerpo = await r.json();
      if (!r.ok) {
        setFase({
          t: "formulario",
          lectura: null,
          nombre: nombre ?? "",
          aviso: cuerpo?.error ?? "No se pudo leer la etiqueta. Escribe los valores.",
        });
        return;
      }
      const lectura = cuerpo.lectura as Lectura;
      setFase({
        t: "formulario",
        lectura,
        nombre: lectura.nombre || nombre || "",
        aviso: !lectura.legible
          ? "No pude leer bien la tabla. Escribe los valores mirando la etiqueta, o intenta con otra foto."
          : !estaCompleta(lectura)
            ? "Faltan algunos valores que no se alcanzaron a leer: complétalos mirando la etiqueta."
            : null,
      });
    } catch {
      setFase({
        t: "formulario",
        lectura: null,
        nombre: nombre ?? "",
        aviso: "No pude procesar la foto. Escribe los valores mirando la etiqueta.",
      });
    }
  }

  const volver = (
    <button type="button" onClick={onCancelar} className="text-sm text-muted underline">
      Volver
    </button>
  );

  if (fase.t === "buscando") {
    return <p className="text-sm text-muted">Buscando {codigo}…</p>;
  }

  if (fase.t === "error") {
    return (
      <div className="space-y-3">
        <Aviso nivel="error">{fase.mensaje}</Aviso>
        {volver}
      </div>
    );
  }

  if (fase.t === "sin_datos") {
    return (
      <div className="space-y-4">
        <Aviso nivel="info">
          {fase.sinTabla
            ? `${fase.nombre ?? "Ese producto"} está en la base pero sin su tabla nutricional. `
            : "Ese producto no está en la base. "}
          Tómale foto a su tabla nutricional y lo agregamos: la próxima vez que escanees este código saldrá solo.
        </Aviso>
        <button
          type="button"
          onClick={() => setFase({ t: "foto", nombre: fase.nombre })}
          className="w-full rounded-full bg-accent px-5 py-3.5 text-base font-semibold text-sobre-accent"
        >
          Fotografiar la tabla nutricional
        </button>
        <button
          type="button"
          onClick={() => setFase({ t: "formulario", lectura: null, aviso: null, nombre: fase.nombre ?? "" })}
          className="w-full rounded-full bg-hairline-soft px-5 py-3 text-base font-medium text-ink"
        >
          Escribir los valores a mano
        </button>
        {volver}
      </div>
    );
  }

  if (fase.t === "foto") {
    return (
      <div className="space-y-4">
        <CapturaFoto
          emoji="🏷️"
          titulo="Fotografía la tabla nutricional"
          ayuda="De frente, con los números nítidos y sin reflejos. Que entre toda la tabla."
          onFoto={(f) => void alFotoEtiqueta(f, fase.nombre)}
        />
        {volver}
      </div>
    );
  }

  if (fase.t === "leyendo") {
    return <ProgresoEstimacion fotoBase64={fase.foto} etapas={ETAPAS_ETIQUETA} />;
  }

  if (fase.t === "formulario") {
    return (
      <FormularioProducto
        codigo={codigo}
        lectura={fase.lectura}
        nombreInicial={fase.nombre}
        aviso={fase.aviso}
        onOtraFoto={() => setFase({ t: "foto", nombre: fase.nombre || null })}
        onGuardado={(producto) => setFase({ t: "encontrado", producto, guardado: true })}
        onCancelar={onCancelar}
      />
    );
  }

  return (
    <ElegirCantidad
      codigo={codigo}
      producto={fase.producto}
      guardado={fase.guardado}
      onAgregar={onAgregar}
      onCancelar={onCancelar}
    />
  );
}

// ------------------------------------------------------------- cantidad ---

function ElegirCantidad({
  codigo,
  producto,
  guardado,
  onAgregar,
  onCancelar,
}: {
  codigo: string;
  producto: ProductoEscaneado;
  guardado: boolean;
  onAgregar: (producto: ProductoEscaneado, gramos: number) => void;
  onCancelar: () => void;
}) {
  const [gramos, setGramos] = useState(producto.porcionG ?? 100);
  const [agregando, setAgregando] = useState(false);
  const macros = macrosDePorcion(producto, gramos);

  async function agregar() {
    setAgregando(true);
    let conId = producto;
    // Un producto que vino de Open Food Facts se guarda al agregarlo: la
    // segunda vez ya no depende de la red. Si guardar falla, igual se agrega:
    // la comida no puede quedarse sin registrar por un caché.
    if (!guardado && !producto.foodId) {
      const r = await guardarProducto({
        codigo,
        nombre: producto.marca ? `${producto.nombre} (${producto.marca})` : producto.nombre,
        kcal100: producto.kcal100,
        p100: producto.p100,
        c100: producto.c100,
        g100: producto.g100,
        porcionG: producto.porcionG,
      }).catch(() => null);
      if (r?.ok) conId = { ...producto, foodId: r.foodId };
    }
    onAgregar(conId, gramos);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">{producto.nombre}</p>
        <p className="text-xs text-muted">
          {producto.marca ? `${producto.marca} · ` : ""}
          {producto.kcal100} kcal · {producto.p100}P {producto.c100}C {producto.g100}G por 100
        </p>
      </div>

      <SelectorNumero
        compacto
        etiqueta="cantidad"
        unidad="g"
        valor={gramos}
        min={5}
        max={Math.max(600, Math.round(gramos * 3))}
        paso={5}
        onCambiar={setGramos}
      />

      <p className="text-center font-mono text-sm text-ink tabular-nums">
        {Math.round(macros.kcal)} kcal
        <span className="text-muted">
          {" · "}
          {Math.round(macros.proteinaG)}P {Math.round(macros.carbsG)}C {Math.round(macros.grasaG)}G
        </span>
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={agregando}
          onClick={() => void agregar()}
          className="flex-1 rounded-full bg-accent px-5 py-3.5 text-base font-semibold text-sobre-accent disabled:opacity-50"
        >
          {agregando ? "Agregando…" : "Agregar"}
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-muted underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- formulario ---

const aTexto = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const aNumero = (t: string): number | null => {
  const n = Number(t.replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? null : n;
};

function FormularioProducto({
  codigo,
  lectura,
  nombreInicial,
  aviso,
  onOtraFoto,
  onGuardado,
  onCancelar,
}: {
  codigo: string;
  lectura: Lectura | null;
  nombreInicial: string;
  aviso: string | null;
  onOtraFoto: () => void;
  onGuardado: (producto: ProductoEscaneado) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [base, setBase] = useState<Base>(lectura?.base ?? "porcion");
  const [tamano, setTamano] = useState(aTexto(lectura?.tamano ?? null));
  const [kcal, setKcal] = useState(aTexto(lectura?.kcal ?? null));
  const [prot, setProt] = useState(aTexto(lectura?.proteinaG ?? null));
  const [carbs, setCarbs] = useState(aTexto(lectura?.carbsG ?? null));
  const [grasa, setGrasa] = useState(aTexto(lectura?.grasaG ?? null));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const por100 = useMemo(() => {
    const v = { kcal: aNumero(kcal), proteinaG: aNumero(prot), carbsG: aNumero(carbs), grasaG: aNumero(grasa) };
    if (v.kcal === null || v.proteinaG === null || v.carbsG === null || v.grasaG === null) return null;
    return aPor100(
      { kcal: v.kcal, proteinaG: v.proteinaG, carbsG: v.carbsG, grasaG: v.grasaG },
      base,
      aNumero(tamano),
    );
  }, [kcal, prot, carbs, grasa, base, tamano]);

  const revision = por100 ? revisarPor100(por100) : null;
  const falta = base === "porcion" && aNumero(tamano) === null;
  const puede = por100 !== null && revision !== null && revision.errores.length === 0 && nombre.trim() !== "";

  async function guardar() {
    if (!por100) return;
    setGuardando(true);
    setError(null);
    const porcionG = base === "porcion" ? aNumero(tamano) : null;
    const r = await guardarProducto({
      codigo,
      nombre: nombre.trim(),
      ...por100,
      porcionG,
    }).catch(() => null);
    setGuardando(false);
    if (!r?.ok) {
      setError(r?.error ?? "No se pudo guardar el producto. Intenta de nuevo.");
      return;
    }
    onGuardado({ codigo, nombre: nombre.trim(), marca: null, ...por100, porcionG, foodId: r.foodId });
  }

  const campo = "w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-base text-ink outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      {aviso && <Aviso nivel="atencion">{aviso}</Aviso>}

      <label className="block">
        <span className="text-sm font-medium text-ink-2">Producto</span>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Galletas Festival de vainilla"
          maxLength={120}
          className={`${claseControl} mt-1`}
        />
      </label>

      <div>
        <span className="text-sm font-medium text-ink-2">Los valores de la etiqueta son por…</span>
        <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Base de los valores">
          {(
            [
              ["porcion", "Porción"],
              ["100g", "100 g"],
              ["100ml", "100 ml"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={base === id}
              onClick={() => setBase(id)}
              className={`rounded-full px-3 py-2.5 text-sm transition-colors ${
                base === id ? "bg-accent text-sobre-accent" : "bg-hairline-soft text-ink-2"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {base === "porcion" && (
        <label className="block">
          <span className="text-sm font-medium text-ink-2">Tamaño de una porción (g o ml)</span>
          <input
            type="text"
            inputMode="decimal"
            value={tamano}
            onChange={(e) => setTamano(e.target.value)}
            placeholder="30"
            className={`${campo} mt-1`}
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Numero etiqueta="Calorías" unidad="kcal" valor={kcal} onCambiar={setKcal} clase={campo} />
        <Numero etiqueta="Proteína" unidad="g" valor={prot} onCambiar={setProt} clase={campo} />
        <Numero etiqueta="Carbohidratos" unidad="g" valor={carbs} onCambiar={setCarbs} clase={campo} />
        <Numero etiqueta="Grasa total" unidad="g" valor={grasa} onCambiar={setGrasa} clase={campo} />
      </div>

      {por100 && (
        <p className="rounded-2xl bg-hairline-soft px-4 py-3 text-center font-mono text-sm text-ink tabular-nums">
          Por 100 g: {por100.kcal100} kcal · {por100.p100}P {por100.c100}C {por100.g100}G
        </p>
      )}
      {!por100 && falta && (
        <p className="text-center text-xs text-muted">Falta el tamaño de la porción para pasar los valores a 100 g.</p>
      )}

      {revision?.errores.map((e) => (
        <Aviso key={e} nivel="error">
          {e}
        </Aviso>
      ))}
      {revision?.avisos.map((a) => (
        <Aviso key={a} nivel="atencion">
          {a}
        </Aviso>
      ))}
      {error && <Aviso nivel="error">{error}</Aviso>}

      <button
        type="button"
        disabled={!puede || guardando}
        onClick={() => void guardar()}
        className="w-full rounded-full bg-accent px-5 py-3.5 text-base font-semibold text-sobre-accent disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar producto"}
      </button>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onOtraFoto} className="text-sm text-accent underline underline-offset-4">
          Fotografiar otra vez
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-muted underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Numero({
  etiqueta,
  unidad,
  valor,
  onCambiar,
  clase,
}: {
  etiqueta: string;
  unidad: string;
  valor: string;
  onCambiar: (v: string) => void;
  clase: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-2">
        {etiqueta} <span className="font-normal text-muted">({unidad})</span>
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onCambiar(e.target.value.replace(/[^\d.,]/g, ""))}
        className={`${clase} mt-1`}
      />
    </label>
  );
}
