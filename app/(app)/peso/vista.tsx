"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
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

  const {
    serie,
    pesoDeHoy,
    pesoMetaKg,
    ajuste,
    ritmoEsperadoKgSemana,
    cintura,
    cinturaDeHoy,
    composicion,
    ratio,
  } = estado;

  const ultimaCintura = cintura.at(-1);

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

            {/*
              Vacío por defecto y nunca prellenado con la medida anterior: un
              número que ya está ahí invita a guardarlo sin medir, y una medida
              inventada contamina la lectura durante semanas. El peso sí se
              prellena porque cambia poco; la cintura, si no la mediste hoy,
              mejor que quede vacía.
            */}
            <Campo
              etiqueta={
                cinturaDeHoy !== null
                  ? "Cintura (ya registrada hoy)"
                  : "Cintura, en cm — opcional"
              }
              ayuda={
                cinturaDeHoy !== null
                  ? "Dejala vacía si solo venís a corregir el peso: no se borra."
                  : "Una vez por semana alcanza. En ayunas, de pie, a la altura del ombligo, después de soltar el aire y sin meter la panza."
              }
            >
              <input
                name="cinturaCm"
                type="number"
                min={40}
                max={250}
                step={0.1}
                inputMode="decimal"
                placeholder={
                  ultimaCintura ? `la última fue ${ultimaCintura.cinturaCm}` : "94.5"
                }
                defaultValue={cinturaDeHoy ?? ""}
                className={claseControl}
              />
            </Campo>

            <button
              type="submit"
              disabled={guardando}
              className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
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

        <div>
          <TituloSeccion>Cintura</TituloSeccion>
          <TarjetaComposicion
            composicion={composicion}
            medidas={cintura}
            ratio={ratio}
          />
        </div>

        {ajuste && (
          <div>
            <TituloSeccion>Ajuste semanal</TituloSeccion>
            <TarjetaAjuste
              ajuste={ajuste}
              ritmo={ritmoEsperadoKgSemana}
            />
          </div>
        )}

        {/* La importación del reloj vivía solo detrás de un enlace en
            Historial y no se encontraba. Va acá porque es parte de la misma
            rutina semanal: pesarse, medirse y traer el gasto del reloj. */}
        <div>
          <TituloSeccion>Gasto del reloj</TituloSeccion>
          <Tarjeta>
            <p className="text-sm text-ink-2">
              Importá el CSV de Garmin Connect y el déficit de cada día se
              calcula contra el gasto que midió el reloj, no contra la fórmula.
            </p>
            <Link
              href="/garmin"
              className="mt-3 block rounded-xl border border-hairline px-4 py-2.5 text-center text-sm text-ink-2"
            >
              Importar desde Garmin
            </Link>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

/**
 * Lo que dicen la cintura y el peso juntos.
 *
 * Sin color de "bien" o "mal": la misma lectura es buena o mala según lo que
 * estés buscando —subir de peso sin ensanchar es excelente para quien gana
 * músculo y alarmante para quien baja grasa—. La app describe; el juicio es
 * de quien lee.
 */
function TarjetaComposicion({
  composicion,
  medidas,
  ratio,
}: {
  composicion: EstadoPeso["composicion"];
  medidas: EstadoPeso["cintura"];
  ratio: EstadoPeso["ratio"];
}) {
  const { titulo, detalle, deltaCinturaCm, deltaPesoKg, dias } = composicion;

  return (
    <Tarjeta>
      <p className="font-medium text-ink">{titulo}</p>
      <p className="mt-1.5 text-sm text-ink-2">{detalle}</p>

      {ratio && (
        // Cintura sobre estatura: la regla es "menos de la mitad". Distingue
        // mejor que el IMC, que con 61 kg de masa magra da "sobrepeso" y no
        // significa nada.
        <p className="mt-2.5 text-sm text-ink-2">
          Cintura sobre estatura:{" "}
          <span className="font-mono tabular-nums">
            {ratio.ratio.toFixed(3)}
          </span>
          {ratio.bajoUmbral
            ? " — por debajo de 0.50, que es el umbral."
            : ` — faltan ${ratio.cmParaUmbral.toFixed(1)} cm para bajar de 0.50.`}
        </p>
      )}

      {deltaCinturaCm !== null && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-hairline-soft pt-3 font-mono text-xs text-muted tabular-nums">
          <span>
            cintura {conSigno(deltaCinturaCm)} cm
            {dias !== null && ` en ${dias} d`}
          </span>
          {deltaPesoKg !== null && <span>peso {conSigno(deltaPesoKg)} kg</span>}
        </div>
      )}

      {medidas.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {/* Las últimas seis, de la más vieja a la más nueva: la serie cruda
              al lado de la interpretación, para poder desconfiar de ella. */}
          {medidas.slice(-6).map((m) => (
            <li key={m.fecha} className="font-mono tabular-nums">
              {m.fecha.slice(5)} · {m.cinturaCm}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/** Un "+" explícito: sin él, −2 y 2 se leen distinto de un vistazo. */
function conSigno(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(1)}`;
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
            className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
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
