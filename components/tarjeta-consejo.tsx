import { Tarjeta } from "@/components/ui";
import type { Area, Consejo } from "@/lib/coach/consejos";

/**
 * Un consejo, con las cifras de las que sale.
 *
 * La evidencia va visible y no escondida detrás de un "ver más": es lo que
 * separa un asesor de una galleta de la fortuna. Si el número está mal, se ve;
 * si el consejo no convence, se puede discutir con el dato al lado.
 */

const NOMBRE_AREA: Record<Area, string> = {
  calorias: "Calorías",
  proteina: "Proteína",
  gasto: "Gasto",
  actividad: "Actividad",
  sueno: "Sueño",
  registro: "Registro",
};

export function TarjetaConsejo({ consejo }: { consejo: Consejo }) {
  return (
    <Tarjeta>
      <p className="text-xs tracking-wide text-muted uppercase">
        {NOMBRE_AREA[consejo.area]}
      </p>
      <h3 className="mt-1 font-medium text-ink">{consejo.titulo}</h3>
      <p className="mt-1.5 text-sm text-ink-2">{consejo.detalle}</p>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline-soft pt-3">
        {consejo.evidencia.map((e) => (
          <li key={e} className="font-mono text-xs text-muted tabular-nums">
            {e}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
