"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso, Encabezado, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
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
  totalesDeItems,
  type ItemBorrador,
} from "@/lib/registro/tipos";
import type { ComidaSuelta } from "@/lib/datos/diario";
import { actualizarComida, borrarComida } from "../../registrar/acciones";

/**
 * Corregir una comida ya guardada.
 *
 * Es la misma tarjeta editable del registro: corregir después no es un modo
 * aparte, es lo mismo que corregir antes de guardar. Lo único que cambia es de
 * dónde vienen los ítems y a dónde van.
 *
 * El borrado pide confirmación en dos toques. Es la única acción de la app que
 * destruye datos y no se puede deshacer.
 */
export function EditarComida({
  comida,
  alimentos,
}: {
  comida: ComidaSuelta;
  alimentos: Alimento[];
}) {
  const router = useRouter();

  const [items, setItems] = useState<ItemEditable[]>(() =>
    comida.items.map((i) => ({
      clave: i.id,
      foodId: i.foodId,
      alimento: i.alimento,
      porcionG: i.porcionG,
      porcionMl: i.porcionMl,
      kcal: i.kcal,
      proteinaG: i.proteinaG,
      carbsG: i.carbsG,
      grasaG: i.grasaG,
      nota: i.nota,
    })),
  );
  const [momento, setMomento] = useState(comida.momento);
  const [consulta, setConsulta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [trabajando, iniciar] = useTransition();

  const totales = totalesDeItems(items);
  const resultados = consulta.trim()
    ? buscarAlimentos(alimentos, consulta, 8)
    : [];

  const volver = () =>
    router.push(`/hoy?fecha=${comida.fecha}` as never);

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
    iniciar(async () => {
      const r = await actualizarComida(comida.id, {
        fecha: comida.fecha,
        momento,
        origen: comida.origen,
        confianza: comida.confianza,
        corregido: true,
        nota: comida.nota,
        scanSessionId: null,
        items: items.map(aItemBorrador),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      volver();
    });
  }

  function borrar() {
    setError(null);
    iniciar(async () => {
      const r = await borrarComida(comida.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      volver();
    });
  }

  return (
    <>
      <Encabezado
        titulo="Corregir"
        bajada={`${NOMBRE_MOMENTO[momento as keyof typeof NOMBRE_MOMENTO] ?? momento} del ${comida.fecha.slice(5)}`}
      />

      <div className="space-y-6 px-5">
        {comida.fotoUrl && (
          <div>
            <TituloSeccion>La foto</TituloSeccion>
            {/*
              Grande y arriba de todo: acá es donde de verdad sirve. Mirando el
              plato se juzga si 200 g de pollo eran 200 g, que es la corrección
              que más se hace y la que más mueve el número.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comida.fotoUrl}
              alt="La foto con la que se registró esta comida"
              className="w-full rounded-2xl border border-hairline object-cover"
            />
          </div>
        )}

        <div>
          <TituloSeccion>Lo que comiste</TituloSeccion>
          <Tarjeta>
            {items.length === 0 ? (
              <p className="text-sm text-muted">
                No queda ningún alimento. Agregá al menos uno, o borrá la
                comida entera.
              </p>
            ) : (
              <EditorItems
                items={items}
                alimentos={alimentos}
                onCambiar={setItems}
              />
            )}

            <div className="mt-3 flex items-baseline justify-between border-t border-hairline-soft pt-3">
              <span className="text-sm text-ink-2">Total</span>
              <span className="font-mono text-sm tabular-nums text-ink">
                {Math.round(totales.kcal)} kcal
                <span className="text-muted">
                  {" · "}
                  {Math.round(totales.proteinaG)}P {Math.round(totales.carbsG)}C{" "}
                  {Math.round(totales.grasaG)}G
                </span>
              </span>
            </div>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-ink-2">Momento</span>
              <select
                value={momento}
                onChange={(e) => setMomento(e.target.value)}
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
              disabled={trabajando || items.length === 0}
              className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
            >
              {trabajando ? "Guardando…" : "Guardar los cambios"}
            </button>

            <Link
              href={`/hoy?fecha=${comida.fecha}`}
              className="mt-2 block py-2 text-center text-sm text-muted"
            >
              Cancelar
            </Link>

            {error && (
              <div className="mt-3">
                <Aviso nivel="error">{error}</Aviso>
              </div>
            )}
          </Tarjeta>
        </div>

        <div>
          <TituloSeccion>Agregar algo que falta</TituloSeccion>
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="arepa, pollo, chicharrón…"
            aria-label="Buscar un alimento para agregar"
            className={`${claseControl} mt-0`}
          />
          {resultados.length > 0 && (
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
                        {alimento.kcal100} kcal · {alimento.p100}P por 100 g
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-accent">Agregar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pb-4">
          <TituloSeccion>Borrar</TituloSeccion>
          {confirmandoBorrado ? (
            <Tarjeta>
              <p className="text-sm text-ink-2">
                Se borra la comida entera con sus {comida.items.length}{" "}
                {comida.items.length === 1 ? "alimento" : "alimentos"}. No se
                puede deshacer.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={borrar}
                  disabled={trabajando}
                  className="flex-1 rounded-xl bg-bad px-4 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  {trabajando ? "Borrando…" : "Sí, borrar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrado(false)}
                  className="flex-1 rounded-xl border border-hairline px-4 py-3 text-base text-ink"
                >
                  No
                </button>
              </div>
            </Tarjeta>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              className="w-full rounded-xl border border-hairline px-4 py-3 text-sm text-bad"
            >
              Borrar esta comida
            </button>
          )}
        </div>
      </div>
    </>
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
