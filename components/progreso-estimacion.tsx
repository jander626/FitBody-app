"use client";

import { useEffect, useState } from "react";
import { etapaDeEspera, porcentajeDeEspera } from "@/lib/registro/presentacion";

/**
 * Lo que se ve mientras el modelo estima una comida.
 *
 * Una estimación tarda varios segundos, y un botón que dice "Estimando…" se
 * siente colgado. Acá hay una foto (si la hay), etapas que van pasando y una
 * barra que se llena. La barra no es el progreso real —el modelo no avisa—,
 * sino una curva que se acerca al final sin llegar hasta que la respuesta
 * llega: ver `porcentajeDeEspera` en `lib/registro/presentacion.ts`.
 *
 * Cuando la respuesta llega este componente se desmonta, así que no necesita
 * saber cómo termina.
 */
export function ProgresoEstimacion({
  fotoBase64,
  etapas,
  compacto = false,
}: {
  fotoBase64?: string | null;
  etapas: string[];
  /** Una línea y una barra, para un ajuste dentro de otra tarjeta. */
  compacto?: boolean;
}) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const inicio = performance.now();
    const id = setInterval(() => setMs(performance.now() - inicio), 150);
    return () => clearInterval(id);
  }, []);

  const pct = porcentajeDeEspera(ms);
  const etapa = etapaDeEspera(ms, etapas.length);

  const barra = (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-hairline-soft"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={etapas[etapa]}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--macro-carb), var(--accent))" }}
      />
    </div>
  );

  if (compacto) {
    return (
      <div className="mt-2" aria-live="polite">
        <p className="mb-1.5 text-sm text-ink-2">{etapas[etapa]}…</p>
        {barra}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4 text-center" aria-live="polite">
      {fotoBase64 ? (
        <div className="relative mx-auto aspect-square w-full max-w-[16rem] overflow-hidden rounded-[2rem] border border-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${fotoBase64}`} alt="" className="h-full w-full object-cover" />
          {/* Una barrida de luz sobre la foto: es lo que dice "estoy mirando
              esto" y no "me colgué". */}
          <span className="barrido pointer-events-none absolute inset-x-0 h-1/3" aria-hidden="true" />
        </div>
      ) : (
        <p className="respira text-6xl" aria-hidden="true">
          📝
        </p>
      )}

      <div className="mx-auto w-full max-w-sm space-y-3 text-left">
        {barra}
        <ul className="space-y-2">
          {etapas.map((texto, i) => (
            <li key={texto} className={`flex items-center gap-3 text-sm ${i <= etapa ? "text-ink" : "text-muted"}`}>
              <span
                key={i < etapa ? "ok" : i === etapa ? "ahora" : "espera"}
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  i < etapa
                    ? "pop bg-accent text-sobre-accent"
                    : i === etapa
                      ? "border-2 border-accent"
                      : "border border-hairline"
                }`}
                aria-hidden="true"
              >
                {i < etapa ? "✓" : ""}
              </span>
              {texto}
              {i === etapa && <span className="animate-pulse text-muted">…</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
