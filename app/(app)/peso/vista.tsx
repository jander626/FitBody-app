"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso, Tarjeta, TituloSeccion } from "@/components/ui";
import { GraficoPeso } from "@/components/grafico-peso";
import { useCuenta } from "@/components/movimiento";
import { SelectorNumero } from "@/components/selector-numero";
import type { EstadoPeso } from "@/lib/datos/peso";
import { aceptarAjuste, guardarPeso, type Resultado } from "./acciones";

export function VistaPeso({
  estado,
  fecha,
}: {
  estado: EstadoPeso;
  fecha: string;
}) {
  const { serie, pesoDeHoy, pesoMetaKg, ajuste, ritmoEsperadoKgSemana } = estado;

  const ultimo = serie.at(-1);
  // La media móvil más reciente que exista. Los primeros días no tienen, así
  // que no siempre es el último punto de la serie.
  const tendencia = serie.reduce<number | null>(
    (ultima, p) => (p.mediaKg !== null ? p.mediaKg : ultima),
    null,
  );
  // El primer punto con media: contra él se mide cuánto se ha movido.
  const primera = serie.find((p) => p.mediaKg !== null);
  const cambio =
    tendencia !== null && primera?.mediaKg != null ? tendencia - primera.mediaKg : null;

  return (
    <>
      <header className="px-5 pt-8 pb-2">
        <p className="entra text-sm text-muted">Tendencia de peso</p>
        {tendencia !== null ? (
          <Tendencia valor={tendencia} cambio={cambio} desde={primera?.fecha ?? null} metaKg={pesoMetaKg} />
        ) : (
          <p className="entra mt-1 text-sm text-ink-2" style={{ "--i": 1 } as React.CSSProperties}>
            Pésate unos días seguidos, en ayunas, y aquí aparece tu tendencia.
          </p>
        )}
      </header>

      <div className="space-y-5 px-5 pt-3">
        <div className="entra" style={{ "--i": 2 } as React.CSSProperties}>
          <RegistroDePeso fecha={fecha} pesoDeHoy={pesoDeHoy} ultimoKg={ultimo?.pesoKg ?? null} />
        </div>

        {serie.length > 0 && (
          <div className="entra" style={{ "--i": 3 } as React.CSSProperties}>
            <TituloSeccion>Trayectoria</TituloSeccion>
            <Tarjeta>
              <GraficoPeso serie={serie} pesoMetaKg={pesoMetaKg} />
            </Tarjeta>
          </div>
        )}

        {ajuste && (
          <div className="entra" style={{ "--i": 4 } as React.CSSProperties}>
            <TituloSeccion>Ajuste semanal</TituloSeccion>
            <TarjetaAjuste ajuste={ajuste} ritmo={ritmoEsperadoKgSemana} />
          </div>
        )}
      </div>
    </>
  );
}

/** El número grande, que sube hasta su valor, y cuánto se ha movido. */
function Tendencia({
  valor,
  cambio,
  desde,
  metaKg,
}: {
  valor: number;
  cambio: number | null;
  desde: string | null;
  metaKg: number | null;
}) {
  const animado = useCuenta(valor, 900);
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  const baja = cambio !== null && cambio < -0.05;
  const sube = cambio !== null && cambio > 0.05;
  // Si la meta es bajar, bajar es "bien"; si no hay meta, no se juzga.
  const buscaBajar = metaKg !== null && metaKg < valor;
  const bien = (baja && buscaBajar) || (sube && metaKg !== null && metaKg > valor);

  return (
    <div className="entra" style={{ "--i": 1 } as React.CSSProperties}>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-6xl font-semibold tracking-tight text-ink tabular-nums">
          {fmt(animado)}
        </span>
        <span className="text-xl text-muted">kg</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {cambio !== null && (baja || sube) && (
          <span
            className={`pop inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium ${
              bien ? "bg-good-bg text-good" : "bg-hairline-soft text-ink-2"
            }`}
          >
            {baja ? "↓" : "↑"} {fmt(Math.abs(cambio))} kg
          </span>
        )}
        {desde && <span className="text-muted">desde el {desde.slice(8)}/{desde.slice(5, 7)}</span>}
        {metaKg !== null && (
          <span className="text-muted">
            · meta {fmt(metaKg)} kg
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Anotar el peso de hoy deslizando.
 *
 * Arranca en lo último que pesaste: el peso cambia poco entre días, y mover
 * el deslizador unas décimas es más rápido y menos propenso a errores que
 * teclear. El botón dice si guarda o corrige, porque un valor ya puesto se ve
 * igual a uno guardado y era fácil creer que se había guardado sin tocar nada.
 */
function RegistroDePeso({
  fecha,
  pesoDeHoy,
  ultimoKg,
}: {
  fecha: string;
  pesoDeHoy: number | null;
  ultimoKg: number | null;
}) {
  const [resultado, accionGuardar, guardando] = useActionState<Resultado | null, FormData>(
    guardarPeso,
    null,
  );
  const [valor, setValor] = useState(pesoDeHoy ?? ultimoKg ?? 70);

  return (
    <Tarjeta>
      <form action={accionGuardar} className="space-y-5">
        <input type="hidden" name="fecha" value={fecha} />
        <input type="hidden" name="pesoKg" value={valor} />

        <div>
          <p className="font-medium text-ink">{pesoDeHoy !== null ? "Tu peso de hoy" : "¿Cuánto pesas hoy?"}</p>
          <p className="mt-0.5 text-xs text-muted">
            {pesoDeHoy !== null
              ? "Ya está registrado. Un segundo pesaje corrige al primero."
              : "En ayunas y en las mismas condiciones, para que se pueda comparar."}
          </p>
        </div>

        <SelectorNumero
          etiqueta="peso"
          unidad="kg"
          valor={valor}
          min={30}
          max={250}
          paso={0.1}
          decimales={1}
          onCambiar={setValor}
        />

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-full bg-accent px-5 py-4 text-base font-semibold text-sobre-accent disabled:opacity-50"
        >
          {guardando ? "Guardando…" : pesoDeHoy !== null ? "Corregir el de hoy" : "Guardar"}
        </button>

        {resultado?.ok === true && (
          <div className="pop">
            <Aviso nivel="bien">{resultado.mensaje}</Aviso>
          </div>
        )}
        {resultado?.ok === false && <Aviso nivel="error">{resultado.error}</Aviso>}
      </form>
    </Tarjeta>
  );
}

function TarjetaAjuste({
  ajuste,
  ritmo,
}: {
  ajuste: NonNullable<EstadoPeso["ajuste"]>;
  ritmo: EstadoPeso["ritmoEsperadoKgSemana"];
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [aplicando, iniciar] = useTransition();

  const proponeCambio =
    ajuste.sugerencia === "bajar" || ajuste.sugerencia === "subir";

  return (
    <Tarjeta>
      <p className="text-sm text-ink-2">{ajuste.razon}</p>

      {ritmo && (
        <p className="mt-2 font-mono text-xs text-muted tabular-nums">
          esperado {ritmo.min.toFixed(2)} a {ritmo.max.toFixed(2)} kg/semana
        </p>
      )}

      {proponeCambio && resultado?.ok !== true && (
        <>
          <div className="mt-3 flex items-baseline justify-between border-t border-hairline-soft pt-3">
            <span className="text-sm text-ink-2">Objetivo propuesto</span>
            <span className="font-mono text-sm text-ink tabular-nums">
              {ajuste.kcalActual} → {ajuste.kcalPropuesto} kcal
            </span>
          </div>

          <button
            type="button"
            disabled={aplicando}
            onClick={() =>
              iniciar(async () =>
                setResultado(await aceptarAjuste(ajuste.kcalPropuesto)),
              )
            }
            className="mt-3 w-full rounded-full bg-accent px-5 py-4 text-base font-semibold text-sobre-accent disabled:opacity-50"
          >
            {aplicando ? "Aplicando…" : "Aceptar el ajuste"}
          </button>

          <p className="mt-2 text-xs text-muted">
            Nada cambia hasta que toques el botón. Si preferís esperar otra
            semana de datos, esperar también es una decisión válida.
          </p>
        </>
      )}

      {resultado?.ok === true && (
        <div className="mt-3">
          <Aviso nivel="bien">{resultado.mensaje}</Aviso>
        </div>
      )}
      {resultado?.ok === false && (
        <div className="mt-3">
          <Aviso nivel="error">{resultado.error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
