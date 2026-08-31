"use client";

import { Tarjeta, TituloSeccion } from "@/components/ui";
import { leerComida, type ContextoComida, type Tono } from "@/lib/coach/comida";
import type { Totales } from "@/lib/registro/tipos";

/**
 * Lo que la app tiene para decir de la comida que estás armando.
 *
 * Se recalcula en cada cambio de porción sin pedirle nada a nadie: es
 * aritmética sobre lo que ya está en pantalla. Por eso puede ser instantánea y
 * gratis, que es lo que la hace usable — un consejo que tarda tres segundos y
 * gasta una de las veinte llamadas del día no se consulta mientras se come.
 */

const PUNTO: Record<Tono, string> = {
  bien: "bg-good",
  atencion: "bg-warn",
  info: "bg-muted",
};

export function SenalesComida({
  comida,
  contexto,
}: {
  comida: Totales;
  contexto: ContextoComida;
}) {
  const senales = leerComida(comida, contexto);
  if (senales.length === 0) return null;

  return (
    <div>
      <TituloSeccion>Cómo encaja</TituloSeccion>
      <Tarjeta>
        <ul className="space-y-2.5">
          {senales.map((s) => (
            <li key={s.id} className="flex gap-2.5">
              {/* Un punto de color, no un ícono con significado propio: el
                  color acompaña al texto, nunca lo reemplaza. */}
              <span
                aria-hidden
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${PUNTO[s.tono]}`}
              />
              <span className="text-sm text-ink-2">{s.texto}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 border-t border-hairline-soft pt-2.5 text-xs text-muted">
          Esto mira calorías y macros contra tu objetivo del día. La tabla no
          tiene fibra ni micronutrientes, así que no puede decir si una comida
          es sana — solo si encaja y cuánta proteína trae.
        </p>
      </Tarjeta>
    </div>
  );
}
