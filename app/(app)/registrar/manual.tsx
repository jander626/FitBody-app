"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
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

/** Un ítem del borrador más lo necesario para recalcular al mover la porción. */
interface EnBorrador extends ItemBorrador {
  clave: string;
  alimentoTabla: Alimento | null;
}

/** Deja solo lo que viaja al servidor: `clave` y `alimentoTabla` son de la UI. */
function aItemBorrador(item: EnBorrador): ItemBorrador {
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
  const [items, setItems] = useState<EnBorrador[]>([]);
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
        alimentoTabla: alimento,
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

  /** Al mover la porción, los macros se recalculan desde la tabla. */
  function cambiarPorcion(clave: string, gramos: number) {
    setItems((previos) =>
      previos.map((item) => {
        if (item.clave !== clave || !item.alimentoTabla) return item;
        return {
          ...item,
          porcionG: gramos,
          ...macrosDePorcion(item.alimentoTabla, gramos),
        };
      }),
    );
  }

  function quitar(clave: string) {
    setItems((previos) => previos.filter((i) => i.clave !== clave));
  }

  function guardar() {
    setError(null);
    iniciarGuardado(async () => {
      const resultado = await guardarComida({
        fecha,
        momento,
        origen: "manual",
        confianza: "alta", // Elegido de la tabla y pesado: no hay estimación.
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
            <div className="space-y-3">
              {items.map((item) => (
                <FilaBorrador
                  key={item.clave}
                  item={item}
                  onPorcion={(g) => cambiarPorcion(item.clave, g)}
                  onQuitar={() => quitar(item.clave)}
                />
              ))}
            </div>

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
            Nada con «{consulta}» en la tabla. Podés registrarlo por texto o por
            foto, y queda estimado.
          </p>
        )}
      </div>
    </div>
  );
}

function FilaBorrador({
  item,
  onPorcion,
  onQuitar,
}: {
  item: EnBorrador;
  onPorcion: (gramos: number) => void;
  onQuitar: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm text-ink">{item.alimento}</span>
        <button
          type="button"
          onClick={onQuitar}
          aria-label={`Quitar ${item.alimento}`}
          className="shrink-0 text-xs text-muted underline underline-offset-4"
        >
          Quitar
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={5000}
          step={5}
          inputMode="numeric"
          value={item.porcionG ?? 0}
          onChange={(e) => onPorcion(Number(e.target.value) || 0)}
          aria-label={`Gramos de ${item.alimento}`}
          className="w-24 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink tabular-nums outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">g</span>
        <span className="ml-auto font-mono text-xs text-muted tabular-nums">
          {Math.round(item.kcal)} kcal · {Math.round(item.proteinaG)}P{" "}
          {Math.round(item.carbsG)}C {Math.round(item.grasaG)}G
        </span>
      </div>
    </div>
  );
}
