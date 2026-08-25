"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso, Campo, Encabezado, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import { GraficoPeso } from "@/components/grafico-peso";
import type { EstadoPeso } from "@/lib/datos/peso";
import { aceptarAjuste, guardarPeso, type Resultado } from "./acciones";

export function VistaPeso({
  estado,
  fecha,
}: {
  estado: EstadoPeso;
  fecha: string;
}) {
  const [resultado, accionGuardar, guardando] = useActionState<
    Resultado | null,
    FormData
  >(guardarPeso, null);

  const { serie, pesoDeHoy, pesoMetaKg, ajuste, ritmoEsperadoKgSemana } = estado;

  const ultimo = serie.at(-1);
  // La media móvil más reciente que exista. Los primeros días no tienen, así
  // que no siempre es el último punto de la serie.
  const tendencia = serie.reduce<number | null>(
    (ultima, p) => (p.mediaKg !== null ? p.mediaKg : ultima),
    null,
  );

  return (
    <>
      <Encabezado
        titulo="Peso"
        bajada={
          tendencia !== null
            ? `Tendencia: ${tendencia.toFixed(1)} kg`
            : "Pesate en ayunas, siempre en las mismas condiciones."
        }
      />

      <div className="space-y-6 px-5">
        <Tarjeta>
          <form action={accionGuardar}>
            <input type="hidden" name="fecha" value={fecha} />
            <Campo
              etiqueta={pesoDeHoy !== null ? "Peso de hoy (ya registrado)" : "Peso de hoy"}
              // Un valor rellenado se ve idéntico a uno guardado, y la
              // diferencia estaba solo en la etiqueta y el botón — fácil de
              // pasar por alto, y lleva a creer que se guardó cuando no.
              ayuda={
                pesoDeHoy !== null
                  ? "En ayunas y en las mismas condiciones. Un segundo pesaje corrige al primero."
                  : ultimo
                    ? `Todavía sin registrar. El ${ultimo.fecha.slice(5)} pesaste ${ultimo.pesoKg} kg: cambialo y tocá Guardar.`
                    : "En ayunas y en las mismas condiciones."
              }
            >
              <input
                name="pesoKg"
                type="number"
                required
                min={20}
                max={400}
                step={0.1}
                inputMode="decimal"
                defaultValue={pesoDeHoy ?? ultimo?.pesoKg ?? ""}
                className={claseControl}
              />
            </Campo>

            <button
              type="submit"
              disabled={guardando}
              className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
            >
              {guardando
                ? "Guardando…"
                : pesoDeHoy !== null
                  ? "Corregir el de hoy"
                  : "Guardar"}
            </button>

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
          </form>
        </Tarjeta>

        {serie.length > 0 && (
          <div>
            <TituloSeccion>Trayectoria</TituloSeccion>
            <Tarjeta>
              <GraficoPeso serie={serie} pesoMetaKg={pesoMetaKg} />
            </Tarjeta>
          </div>
        )}

        {ajuste && (
          <div>
            <TituloSeccion>Ajuste semanal</TituloSeccion>
            <TarjetaAjuste
              ajuste={ajuste}
              ritmo={ritmoEsperadoKgSemana}
            />
          </div>
        )}
      </div>
    </>
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
            className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
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
