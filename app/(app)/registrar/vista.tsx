"use client";

import { useState } from "react";
import { Encabezado } from "@/components/ui";
import type { Alimento } from "@/lib/alimentos";
import { Conversacion } from "./conversacion";
import { RegistroManual } from "./manual";

type Modo = "asistido" | "manual";

export function VistaRegistrar({
  alimentos,
  fecha,
  userId,
}: {
  alimentos: Alimento[];
  fecha: string;
  userId: string;
}) {
  const [modo, setModo] = useState<Modo>("asistido");

  return (
    <>
      <Encabezado
        titulo="Registrar"
        bajada={
          modo === "asistido"
            ? "Una foto, una descripción, o las dos. Después lo afinás."
            : "Buscá en la tabla y ajustá la porción. Sin IA, sin estimación."
        }
      />

      <div className="px-5">
        {/* Dos formas de registrar. El buscador no toca la API, así que sigue
            funcionando aunque se agote el cupo de IA o falte la clave. */}
        <div
          role="tablist"
          aria-label="Forma de registrar"
          className="mb-5 flex gap-1 rounded-xl border border-hairline bg-surface p-1"
        >
          {(
            [
              ["asistido", "Foto o texto"],
              ["manual", "Buscar en la tabla"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              role="tab"
              aria-selected={modo === valor}
              onClick={() => setModo(valor)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                modo === valor
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {/*
          Los dos modos quedan montados y solo se esconde uno.

          Antes esto era un ternario que montaba uno y desmontaba el otro, y
          React tira el estado de lo que desmonta. O sea: estimabas una foto,
          te pasabas a "Buscar en la tabla" para verificar una cantidad, y al
          volver no quedaba nada — se había ido una estimación que costó una
          de las veinte llamadas del día. Esconder en vez de desmontar lo
          arregla entero, sin guardar nada en ninguna parte.
        */}
        <div className={modo === "asistido" ? undefined : "hidden"}>
          <Conversacion alimentos={alimentos} fecha={fecha} userId={userId} />
        </div>
        <div className={modo === "manual" ? undefined : "hidden"}>
          <RegistroManual alimentos={alimentos} fecha={fecha} />
        </div>
      </div>
    </>
  );
}
