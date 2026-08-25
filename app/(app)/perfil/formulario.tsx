"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Aviso, Campo, claseControl } from "@/components/ui";
import { actividadDeFactor, metaDeObjetivo } from "@/lib/nutrition/metas";
import type { Objetivo, Perfil } from "@/lib/datos/perfil";
import { guardarPerfil, type ResultadoGuardar } from "./acciones";

export function FormularioPerfil({
  perfil,
  objetivo,
  pesoActualKg,
}: {
  perfil: Perfil;
  objetivo: Objetivo | null;
  pesoActualKg: number | null;
}) {
  const [resultado, accion, enviando] = useActionState<
    ResultadoGuardar | null,
    FormData
  >(guardarPerfil, null);

  // Los valores del plan: se muestran, no se editan. Los valores por defecto
  // son los mismos que traía el formulario cuando se escribían a mano, para
  // que alguien sin objetivo guardado no quede con el plan en blanco.
  const factorActividad = objetivo?.factorActividad ?? 1.375;
  const deficitPct = objetivo?.deficitPct ?? 20;
  const objetivoActual = objetivo?.objetivo ?? "perder_grasa";
  const nivel = actividadDeFactor(factorActividad);
  const meta = metaDeObjetivo(objetivoActual, deficitPct);

  return (
    <form action={accion} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Edad">
          <input
            name="edad"
            type="number"
            required
            min={10}
            max={120}
            inputMode="numeric"
            defaultValue={perfil.edad ?? ""}
            className={claseControl}
          />
        </Campo>

        <Campo etiqueta="Sexo">
          <select
            name="sexo"
            required
            defaultValue={perfil.sexo ?? "hombre"}
            className={claseControl}
          >
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
          </select>
        </Campo>

        <Campo etiqueta="Estatura (cm)">
          <input
            name="estaturaCm"
            type="number"
            required
            min={100}
            max={250}
            step={0.5}
            inputMode="decimal"
            defaultValue={perfil.estaturaCm ?? ""}
            className={claseControl}
          />
        </Campo>

        <Campo etiqueta="Peso hoy (kg)">
          <input
            name="pesoKg"
            type="number"
            required
            min={20}
            max={400}
            step={0.1}
            inputMode="decimal"
            defaultValue={pesoActualKg ?? ""}
            className={claseControl}
          />
        </Campo>
      </div>

      {/*
        El plan es de solo lectura acá: lo fija la encuesta.

        Antes estos tres —factor, objetivo y déficit— se escribían a mano, y
        eso permitía mezclas incoherentes: poner "Mantener" dejando el factor
        que había calculado "ganar músculo". Con dos editores del mismo número
        no hay forma de saber cuál manda.

        La división ahora es: la encuesta fija el plan, el formulario los
        hechos sobre vos. Los valores viajan igual en campos ocultos, para que
        guardar los datos no borre el objetivo.
      */}
      <div className="rounded-xl border border-hairline-soft bg-ground px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink-2">Tu plan</span>
          <Link href="/objetivo" className="text-sm text-accent underline underline-offset-4">
            Cambiar
          </Link>
        </div>

        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Meta</dt>
            <dd className="text-ink">{meta.titulo}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Actividad</dt>
            <dd className="text-right text-ink">
              {nivel ? nivel.titulo : `Factor ${factorActividad}`}
              {nivel && (
                <span className="block text-xs text-muted">{nivel.detalle}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">
              {deficitPct >= 0 ? "Déficit" : "Superávit"}
            </dt>
            <dd className="text-ink">{Math.abs(deficitPct)} %</dd>
          </div>
        </dl>

        {!nivel && (
          <p className="mt-2 text-xs text-muted">
            Este factor no salió de la encuesta. Contestala para ponerle un
            nivel y revisar si sigue siendo el que te corresponde.
          </p>
        )}

        <input type="hidden" name="factorActividad" value={factorActividad} />
        <input type="hidden" name="objetivo" value={objetivoActual} />
        <input type="hidden" name="deficitPct" value={deficitPct} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Peso meta (kg)">
          <input
            name="pesoMetaKg"
            type="number"
            min={20}
            max={400}
            step={0.1}
            inputMode="decimal"
            defaultValue={objetivo?.pesoMetaKg ?? ""}
            className={claseControl}
          />
        </Campo>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
      >
        {enviando ? "Guardando…" : "Guardar y recalcular"}
      </button>

      {resultado?.ok === true && (
        <Aviso nivel="bien">
          Plan actualizado: {resultado.kcal} kcal al día.
        </Aviso>
      )}
      {resultado?.ok === false && <Aviso nivel="error">{resultado.error}</Aviso>}
    </form>
  );
}
