"use client";

/**
 * Elegir un número deslizando.
 *
 * Es el reemplazo de escribir edad, altura o peso: el número es grande, el
 * deslizador se arrastra con el pulgar y los botones ± ajustan de a un paso
 * cuando hace falta precisión. Escribir sigue siendo posible en los pasos que
 * lo necesitan, pero casi nadie quiere teclear su estatura en una encuesta.
 */
export function SelectorNumero({
  valor,
  min,
  max,
  paso = 1,
  unidad,
  decimales = 0,
  onCambiar,
  etiqueta,
  compacto = false,
}: {
  valor: number;
  min: number;
  max: number;
  paso?: number;
  unidad: string;
  decimales?: number;
  onCambiar: (v: number) => void;
  etiqueta: string;
  /** Más chico, para usarlo dentro de una fila y no como pantalla propia. */
  compacto?: boolean;
}) {
  const acotar = (v: number) => {
    const redondeado = Math.round(v / paso) * paso;
    return Math.min(max, Math.max(min, Number(redondeado.toFixed(decimales))));
  };
  const porcentaje = ((valor - min) / (max - min)) * 100;

  return (
    <div className={compacto ? "space-y-3" : "space-y-6"}>
      <div className="flex items-center justify-between gap-3">
        <BotonPaso signo="−" etiqueta={`Bajar ${etiqueta}`} onClick={() => onCambiar(acotar(valor - paso))} />
        <p
          key={valor}
          className={`pop text-center font-mono font-semibold text-ink tabular-nums ${
            compacto ? "text-4xl" : "text-6xl"
          }`}
          style={{ animationDuration: "180ms" }}
          aria-live="polite"
        >
          {valor.toFixed(decimales).replace(".", ",")}
          <span className={`ml-1.5 font-normal text-muted ${compacto ? "text-base" : "text-xl"}`}>{unidad}</span>
        </p>
        <BotonPaso signo="+" etiqueta={`Subir ${etiqueta}`} onClick={() => onCambiar(acotar(valor + paso))} />
      </div>

      <input
        type="range"
        className="rango"
        min={min}
        max={max}
        step={paso}
        value={valor}
        aria-label={`${etiqueta} en ${unidad}`}
        style={{ "--p": `${porcentaje}%` } as React.CSSProperties}
        onChange={(e) => onCambiar(acotar(Number(e.target.value)))}
      />
      <div className={`flex justify-between text-xs text-muted ${compacto ? "-mt-2" : "-mt-4"}`}>
        <span>
          {min} {unidad}
        </span>
        <span>
          {max} {unidad}
        </span>
      </div>
    </div>
  );
}

function BotonPaso({
  signo,
  etiqueta,
  onClick,
}: {
  signo: string;
  etiqueta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-2xl text-ink"
    >
      {signo}
    </button>
  );
}
