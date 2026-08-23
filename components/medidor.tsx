/**
 * Medidor: una razón contra un límite.
 *
 * Es un medidor y no un anillo a propósito. Un anillo de calorías es, en
 * información, una torta de dos porciones — la forma que peor se lee para
 * "cuánto llevo de mi límite". El número grande responde eso de un vistazo y
 * la barra da el contexto.
 *
 * El estado va siempre acompañado del número en texto ("128 / 160 g"), así que
 * la identidad nunca depende del color: es lo que hace legible el medidor con
 * daltonismo, en escala de grises o con alto contraste forzado.
 */

export type EstadoMedidor = "progreso" | "logrado" | "excedido";

const COLOR: Record<EstadoMedidor, string> = {
  progreso: "var(--accent)",
  logrado: "var(--good)",
  excedido: "var(--bad)",
};

export function Medidor({
  etiqueta,
  valor,
  objetivo,
  unidad,
  estado,
  /** Cuando el objetivo es un mínimo (proteína) y no un techo. */
  minimo = false,
}: {
  etiqueta: string;
  valor: number;
  objetivo: number;
  unidad: string;
  estado: EstadoMedidor;
  minimo?: boolean;
}) {
  const pct = objetivo > 0 ? (valor / objetivo) * 100 : 0;
  const relleno = Math.min(100, Math.max(0, pct));
  // La muesca y el color dicen lo mismo y cambian en el mismo punto. Cuando la
  // muesca aparecía a partir del 100 % y el color a partir del 105 %, la barra
  // se contradecía a sí misma: marcaba el exceso y a la vez lo pintaba de "vas
  // bien". Entre el 100 y el 105 % la barra simplemente se ve llena, que es lo
  // que corresponde a estar justo en el límite.
  const excedido = estado === "excedido";
  const color = COLOR[estado];

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-2">{etiqueta}</span>
        <span className="font-mono text-sm text-ink tabular-nums">
          {Math.round(valor)}
          <span className="text-muted">
            {" / "}
            {objetivo} {unidad}
          </span>
        </span>
      </div>

      <div
        className="relative mt-1.5 h-2 overflow-hidden rounded-full"
        role="meter"
        aria-valuenow={Math.round(valor)}
        aria-valuemin={0}
        aria-valuemax={objetivo}
        aria-label={`${etiqueta}: ${Math.round(valor)} de ${objetivo} ${unidad}${
          minimo ? " (mínimo)" : ""
        }`}
        style={{
          // La pista es un paso más claro de la misma rampa, no un gris: así el
          // estado se lee a lo largo de toda la barra.
          background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
        }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${relleno}%`, background: color }}
        />
        {excedido && (
          // Marca del exceso: una muesca en la superficie al final de la barra,
          // con 2px de separación, en vez de un borde alrededor de la marca.
          <div
            className="absolute inset-y-0 right-0 w-1.5 rounded-full"
            style={{ background: "var(--surface)" }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Decide el estado de un macro.
 *
 * La proteína es el único que se persigue hacia arriba: quedarse corto es el
 * problema. En los demás el problema es pasarse.
 */
export function estadoMacro(
  valor: number,
  objetivo: number,
  minimo: boolean,
): EstadoMedidor {
  if (objetivo <= 0) return "progreso";
  const pct = (valor / objetivo) * 100;

  if (minimo) return pct >= 100 ? "logrado" : "progreso";
  // Un 5 % de margen: pasarse por 3 g de grasa no es "excederse".
  return pct > 105 ? "excedido" : "progreso";
}
