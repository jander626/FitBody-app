"use client";

import { repartoDeEnergia, tituloDeComida } from "@/lib/registro/presentacion";
import type { ItemBorrador, Totales } from "@/lib/registro/tipos";
import { useCuenta } from "./movimiento";

/**
 * El encabezado de la comida que se está armando: su título, cuatro números
 * grandes y de dónde vienen las calorías.
 *
 * Los números suben hasta su valor y se reajustan en vivo cuando cambia una
 * porción: ver el total moverse mientras arrastras un deslizador es lo que
 * conecta el gesto con el resultado. La barra de abajo parte las calorías por
 * macro (no los gramos): 30 g de grasa pesan el doble que 30 g de proteína, y
 * es lo que dice si una comida es pesada, ligera o equilibrada.
 */
export function ResumenComida({
  items,
  totales,
  etiqueta,
}: {
  items: Pick<ItemBorrador, "alimento">[];
  totales: Totales;
  /** Una línea chica arriba del título, p. ej. "Creado con IA". */
  etiqueta?: string;
}) {
  const reparto = repartoDeEnergia(totales);

  return (
    <div>
      <div className="text-center">
        {etiqueta && <p className="text-xs text-muted">✨ {etiqueta}</p>}
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink">{tituloDeComida(items)}</h2>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Cifra valor={totales.kcal} unidad="kcal" etiqueta="calorías" />
        <Cifra valor={totales.proteinaG} unidad="g" etiqueta="proteínas" color="var(--macro-prot)" />
        <Cifra valor={totales.carbsG} unidad="g" etiqueta="carbos" color="var(--macro-carb)" />
        <Cifra valor={totales.grasaG} unidad="g" etiqueta="grasas" color="var(--macro-gras)" />
      </div>

      {reparto.proteina + reparto.carbs + reparto.grasa > 0 && (
        <div className="mt-4">
          <div
            className="flex h-2.5 gap-1 overflow-hidden rounded-full"
            role="img"
            aria-label={`De dónde vienen las calorías: ${reparto.proteina} % proteínas, ${reparto.carbs} % carbohidratos, ${reparto.grasa} % grasas`}
          >
            {/* El ancho es proporcional y se anima con la barra entera; el
                transition hace que se reacomode cuando cambia una porción. */}
            <Tramo ancho={reparto.proteina} color="var(--macro-prot)" i={0} />
            <Tramo ancho={reparto.carbs} color="var(--macro-carb)" i={1} />
            <Tramo ancho={reparto.grasa} color="var(--macro-gras)" i={2} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <Leyenda color="var(--macro-prot)" texto={`Proteínas ${reparto.proteina}%`} />
            <Leyenda color="var(--macro-carb)" texto={`Carbos ${reparto.carbs}%`} />
            <Leyenda color="var(--macro-gras)" texto={`Grasas ${reparto.grasa}%`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Cifra({
  valor,
  unidad,
  etiqueta,
  color,
}: {
  valor: number;
  unidad: string;
  etiqueta: string;
  color?: string;
}) {
  // Un instante corto: este número se reajusta con cada movimiento del
  // deslizador, y una cuenta larga iría siempre detrás del dedo.
  const animado = useCuenta(valor, 250);
  return (
    <div className="rounded-2xl border border-hairline bg-surface px-1 py-2.5">
      <p className="font-mono text-lg font-semibold text-ink tabular-nums" style={color ? { color } : undefined}>
        {Math.round(animado)}
        <span className="ml-0.5 text-[10px] font-normal text-muted">{unidad}</span>
      </p>
      <p className="text-[11px] text-muted">{etiqueta}</p>
    </div>
  );
}

function Tramo({ ancho, color, i }: { ancho: number; color: string; i: number }) {
  return (
    <span
      className="crece-x block h-full rounded-full transition-[width] duration-300"
      style={{ width: `${ancho}%`, background: color, "--i": i } as React.CSSProperties}
    />
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      {texto}
    </span>
  );
}
