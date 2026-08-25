"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import { EditorItems, type ItemEditable } from "@/components/editor-items";
import {
  buscarAlimentos,
  macrosDePorcion,
  porcionSugerida,
  type Alimento,
} from "@/lib/alimentos";
import {
  MOMENTOS,
  NOMBRE_MOMENTO,
  momentoSugerido,
  totalesDeItems,
  type ItemBorrador,
} from "@/lib/registro/tipos";
import { guardarComida } from "./acciones";

export function RegistroManual({
  alimentos,
  fecha,
}: {
  alimentos: Alimento[];
  fecha: string;
}) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [momento, setMomento] = useState(() =>
    momentoSugerido(new Date().getHours()),
  );
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  const resultados = useMemo(
    () => buscarAlimentos(alimentos, consulta),
    [alimentos, consulta],
  );

  const totales = totalesDeItems(items);

  function agregar(alimento: Alimento) {
    const gramos = porcionSugerida(alimento);
    setItems((previos) => [
      ...previos,
      {
        clave: `${alimento.id}-${Date.now()}`,
        foodId: alimento.id,
        alimento: alimento.nombre,
        porcionG: gramos,
        porcionMl: null,
        nota: null,
        ...macrosDePorcion(alimento, gramos),
      },
    ]);
    setConsulta("");
  }

  function guardar() {
    setError(null);
    iniciarGuardado(async () => {
      const resultado = await guardarComida({
        fecha,
        momento,
        origen: "manual",
        // Elegido de la tabla y con la porción puesta a mano: no hay estimación.
        confianza: "alta",
        corregido: false,
        nota: null,
        scanSessionId: null,
        items: items.map(aItemBorrador),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setItems([]);
      router.push("/hoy");
    });
  }

  return (
    <div className="space-y-6">
      {items.length > 0 && (
        <div>
          <TituloSeccion>Por guardar</TituloSeccion>
          <Tarjeta>
            <EditorItems
              items={items}
              alimentos={alimentos}
              onCambiar={setItems}
            />

            <div className="mt-3 flex items-baseline justify-between border-t border-hairline-soft pt-3">
              <span className="text-sm text-ink-2">Total</span>
              <span className="font-mono text-sm text-ink tabular-nums">
                {Math.round(totales.kcal)} kcal
                <span className="text-muted">
                  {" · "}
                  {Math.round(totales.proteinaG)}P{" "}
                  {Math.round(totales.carbsG)}C {Math.round(totales.grasaG)}G
                </span>
              </span>
            </div>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-ink-2">Momento</span>
              <select
                value={momento}
                onChange={(e) =>
                  setMomento(e.target.value as (typeof MOMENTOS)[number])
                }
                className={claseControl}
              >
                {MOMENTOS.map((m) => (
                  <option key={m} value={m}>
                    {NOMBRE_MOMENTO[m]}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar en el diario"}
            </button>

            {error && (
              <div className="mt-3">
                <Aviso nivel="error">{error}</Aviso>
              </div>
            )}
          </Tarjeta>
        </div>
      )}

      <div>
        <TituloSeccion>Buscar en la tabla</TituloSeccion>
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="arepa, pollo, chicharrón…"
          aria-label="Buscar un alimento"
          className={`${claseControl} mt-0`}
        />

        {consulta.trim() === "" && (
          // Sin esto el orden se lee como un alfabético roto.
          <p className="mt-2 px-1 text-xs text-muted">
            De más a menos proteína por 100 g.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {resultados.map((alimento) => (
            <li key={alimento.id}>
              <button
                type="button"
                onClick={() => agregar(alimento)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-3.5 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {alimento.nombre}
                  </span>
                  <span className="block text-xs text-muted">
                    {alimento.kcal100} kcal · {alimento.p100}P {alimento.c100}C{" "}
                    {alimento.g100}G por 100 g
                  </span>
                </span>
                <span className="shrink-0 text-xs text-accent">Agregar</span>
              </button>
            </li>
          ))}
        </ul>

        {resultados.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Nada con «{consulta}» en la tabla. Registralo por foto o por texto y
            queda estimado.
          </p>
        )}
      </div>
    </div>
  );
}

/** Deja solo lo que viaja al servidor: `clave` es de la UI. */
function aItemBorrador(item: ItemEditable): ItemBorrador {
  return {
    foodId: item.foodId,
    alimento: item.alimento,
    porcionG: item.porcionG,
    porcionMl: item.porcionMl,
    kcal: item.kcal,
    proteinaG: item.proteinaG,
    carbsG: item.carbsG,
    grasaG: item.grasaG,
    nota: item.nota,
  };
}
