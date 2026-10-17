"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/ui";
import { BarraGuardar } from "@/components/barra-guardar";
import { EditorItems, type ItemEditable } from "@/components/editor-items";
import { FotoAmpliable } from "@/components/foto-ampliable";
import { ResumenComida } from "@/components/resumen-comida";
import type { Alimento } from "@/lib/alimentos";
import {
  MOMENTOS,
  totalesDeItems,
  type ItemBorrador,
} from "@/lib/registro/tipos";
import type { ComidaSuelta } from "@/lib/datos/diario";
import { actualizarComida, borrarComida } from "../../registrar/acciones";

const ETIQUETA_ORIGEN: Record<string, string> = {
  foto: "Registrada con foto",
  descripcion: "Registrada con texto",
  "foto+descripcion": "Registrada con foto y texto",
  manual: "Registrada a mano",
};

/**
 * Corregir una comida ya guardada.
 *
 * Es la misma pantalla del registro: corregir después no es un modo aparte, es
 * lo mismo que corregir antes de guardar. Se llega tocando la comida en Hoy.
 * Arriba la foto grande —acá es donde de verdad sirve: mirando el plato se
 * juzga si 200 g de pollo eran 200 g—, el resumen que se mueve mientras se
 * ajusta, los ingredientes con su deslizador y "Agregar ingrediente". Abajo, la
 * barra fija con la comida a la que pertenece y el botón de guardar.
 *
 * Borrar es la única acción de la app que destruye datos y no se puede
 * deshacer, así que va separada de guardar y pide confirmación.
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
  const [fecha, setFecha] = useState(comida.fecha);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [trabajando, iniciar] = useTransition();

  const totales = totalesDeItems(items);

  // Al día donde quedó la comida, no al que estaba: si se movió de fecha,
  // volver al viejo mostraría una pantalla sin ella y parecería que se perdió.
  const volver = (destino: string = fecha) =>
    router.push(`/hoy?fecha=${destino}` as never);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await actualizarComida(comida.id, {
        fecha,
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
        setConfirmandoBorrado(false);
        return;
      }
      // Al día original: la comida ya no existe, y llevar al día que se estaba
      // editando mostraría una fecha que nunca la tuvo.
      volver(comida.fecha);
    });
  }

  return (
    <>
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link
          href={`/hoy?fecha=${comida.fecha}`}
          aria-label="Cerrar sin guardar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </Link>
        <h1 className="flex-1 pr-11 text-center font-serif text-xl text-ink">
          Corregir comida
        </h1>
      </header>

      <div className="space-y-5 px-5">
        {comida.fotoUrl && (
          <div className="entra overflow-hidden rounded-[2rem] border border-hairline">
            <FotoAmpliable
              src={comida.fotoUrl}
              alt="La foto con la que se registró esta comida"
              etiqueta="Ver la foto a pantalla completa"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}

        <ResumenComida
          items={items}
          totales={totales}
          etiqueta={ETIQUETA_ORIGEN[comida.origen]}
        />

        <div className="rounded-3xl border border-hairline bg-surface p-4 shadow-[var(--shadow)]">
          {items.length === 0 && (
            <p className="mb-3 text-sm text-muted">
              No queda ningún alimento. Agrega al menos uno, o borra la comida
              entera.
            </p>
          )}
          <EditorItems items={items} alimentos={alimentos} onCambiar={setItems} />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3">
          <span className="text-sm font-medium text-ink-2">Día</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value || comida.fecha)}
            className="bg-transparent text-right text-sm text-ink outline-none"
          />
        </label>

        {error && <Aviso nivel="error">{error}</Aviso>}
      </div>

      {confirmandoBorrado && (
        <div
          className="pop fixed inset-0 z-30 flex items-end bg-black/50 px-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          role="alertdialog"
          aria-label="Borrar esta comida"
        >
          <div className="mx-auto w-full max-w-md rounded-[2rem] bg-surface p-5">
            <h2 className="font-serif text-xl text-ink">¿Borrar esta comida?</h2>
            <p className="mt-2 text-sm text-ink-2">
              Se borra la comida entera con sus {comida.items.length}{" "}
              {comida.items.length === 1 ? "alimento" : "alimentos"}. No se puede
              deshacer.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(false)}
                className="flex-1 rounded-full bg-hairline-soft px-4 py-3.5 text-base font-medium text-ink"
              >
                No
              </button>
              <button
                type="button"
                onClick={borrar}
                disabled={trabajando}
                className="flex-1 rounded-full bg-bad px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
              >
                {trabajando ? "Borrando…" : "Sí, borrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BarraGuardar
        activa
        momento={momento as (typeof MOMENTOS)[number]}
        onMomento={setMomento}
        kcal={totales.kcal}
        guardando={trabajando}
        deshabilitado={items.length === 0}
        onGuardar={guardar}
        onDescartar={() => setConfirmandoBorrado(true)}
        verbo="Guardar cambios"
        etiquetaDescartar="Borrar esta comida"
      />
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
