/**
 * Medidor de arco para un objetivo con margen.
 *
 * Muestra un número central y, debajo, el rango en que el día cuenta como
 * bueno. Es decorativo en el sentido de que el dato completo va escrito al
 * lado: el arco acompaña, no es la única forma de leer el número.
 */
export function MedidorSemicirculo({
  valor,
  unidad,
  min,
  max,
}: {
  valor: number;
  unidad: string;
  min: number;
  max: number;
}) {
  // Semicírculo de radio 90 centrado en (100, 100); se recorre de izquierda a
  // derecha. `t` va de 0 a 1.
  const punto = (t: number) => {
    const ang = Math.PI * (1 - t);
    return { x: 100 + 90 * Math.cos(ang), y: 100 - 90 * Math.sin(ang) };
  };
  const arco = (desde: number, hasta: number) => {
    const a = punto(desde);
    const b = punto(hasta);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A 90 90 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };

  // El arco entero es el rango, del mínimo al máximo; el objetivo cae en medio.
  const marca = punto(0.5);

  return (
    <figure
      className="text-center"
      role="img"
      aria-label={`${valor} ${unidad} al día, con un rango de ${min} a ${max} ${unidad}`}
    >
      <p className="font-mono text-4xl font-semibold text-ink tabular-nums">
        {valor.toLocaleString("es-CO")}
        <span className="ml-1 text-base font-normal text-muted">{unidad}</span>
      </p>

      <svg viewBox="0 -10 200 115" className="mx-auto mt-2 w-full max-w-xs" aria-hidden="true">
        <path
          d={arco(0, 1)}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.28"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={arco(0.04, 0.96)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle
          cx={marca.x}
          cy={marca.y}
          r="9"
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth="4"
        />
      </svg>

      <figcaption className="mt-1 flex justify-between px-1 text-sm text-muted">
        <span>
          <span className="block text-xs">Mínimo</span>
          <span className="font-mono text-ink-2 tabular-nums">
            {min.toLocaleString("es-CO")}
          </span>
        </span>
        <span>
          <span className="block text-xs">Máximo</span>
          <span className="font-mono text-ink-2 tabular-nums">
            {max.toLocaleString("es-CO")}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
