"use client";

import { useActionState } from "react";
import { Aviso, Campo, claseControl } from "@/components/ui";
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

      <Campo
        etiqueta="Factor de actividad"
        ayuda="1.2 sedentario · 1.375 ligero · 1.55 moderado · 1.725 activo. Si tenés pasos reales del reloj, un valor intermedio es más fiel que el escalón más cercano."
      >
        <input
          name="factorActividad"
          type="number"
          required
          min={1}
          max={2.5}
          step={0.01}
          inputMode="decimal"
          defaultValue={objetivo?.factorActividad ?? 1.375}
          className={claseControl}
        />
      </Campo>

      <Campo etiqueta="Objetivo">
        <select
          name="objetivo"
          required
          defaultValue={objetivo?.objetivo ?? "perder_grasa"}
          className={claseControl}
        >
          <option value="perder_grasa">Perder grasa</option>
          <option value="mantener">Mantener</option>
          <option value="ganar_musculo">Ganar músculo</option>
        </select>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Déficit (%)"
          ayuda="Negativo para superávit."
        >
          <input
            name="deficitPct"
            type="number"
            required
            min={-30}
            max={40}
            step={1}
            inputMode="numeric"
            defaultValue={objetivo?.deficitPct ?? 20}
            className={claseControl}
          />
        </Campo>

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
        className="w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
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
