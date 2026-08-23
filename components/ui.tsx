/**
 * Primitivas compartidas.
 *
 * Deliberadamente pocas y sin configuración: la app son cuatro pantallas, y
 * un sistema de diseño más elaborado costaría más de lo que ahorra.
 */
import type { ReactNode } from "react";

export function Encabezado({
  titulo,
  bajada,
  accion,
}: {
  titulo: string;
  bajada?: string;
  accion?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-8 pb-4">
      <div>
        <h1 className="font-serif text-2xl text-ink">{titulo}</h1>
        {bajada && <p className="mt-1 text-sm text-muted">{bajada}</p>}
      </div>
      {accion}
    </header>
  );
}

export function Tarjeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-hairline bg-surface p-4 ${className}`}
    >
      {children}
    </section>
  );
}

export function TituloSeccion({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pb-2 text-xs font-medium tracking-wide text-muted uppercase">
      {children}
    </h2>
  );
}

/** Fila etiqueta/valor, para las lecturas del plan. */
export function Dato({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-2">{etiqueta}</span>
      <span className="text-right">
        <span className="font-mono text-sm text-ink tabular-nums">{valor}</span>
        {detalle && (
          <span className="ml-1.5 text-xs text-muted">{detalle}</span>
        )}
      </span>
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-2">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-muted">{ayuda}</span>}
    </label>
  );
}

/** Clases compartidas de los controles, para que no se desincronicen. */
export const claseControl =
  "mt-1.5 w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-base text-ink outline-none focus:border-accent";

export function Aviso({
  nivel,
  children,
}: {
  nivel: "info" | "atencion" | "error" | "bien";
  children: ReactNode;
}) {
  const estilos = {
    info: "border-hairline bg-accent-soft text-ink-2",
    atencion: "border-hairline bg-warn-bg text-warn",
    error: "border-hairline bg-bad-bg text-bad",
    bien: "border-hairline bg-good-bg text-good",
  }[nivel];

  return (
    <p
      role={nivel === "error" ? "alert" : undefined}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${estilos}`}
    >
      {children}
    </p>
  );
}
