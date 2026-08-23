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

        {modo === "asistido" ? (
          <Conversacion
            alimentos={alimentos}
            fecha={fecha}
            userId={userId}
          />
        ) : (
          <RegistroManual alimentos={alimentos} fecha={fecha} />
        )}
      </div>
    </>
  );
}
