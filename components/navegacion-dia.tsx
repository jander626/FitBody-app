"use client";

import { useRouter } from "next/navigation";

/**
 * Moverse entre días del diario.
 *
 * En el celular escribir una fecha en la URL no es una opción, así que hacen
 * falta las flechas. La fecha además abre el selector nativo del sistema, que
 * es lo que la gente ya sabe usar y no hay que reinventar.
 *
 * No se puede ir más allá de hoy: un día futuro siempre estaría vacío y el
 * botón muerto confunde menos que una pantalla en blanco sin explicación.
 */

const DIA_MS = 86_400_000;

function sumarDias(fecha: string, dias: number): string {
  // Se calcula en UTC para que no cambie de día según la zona horaria.
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS)
    .toISOString()
    .slice(0, 10);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "martes 24 de ago" — sin el año, que en un diario diario sobra. */
function enPalabras(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function NavegacionDia({
  fecha,
  hoy,
}: {
  fecha: string;
  hoy: string;
}) {
  const router = useRouter();
  const esHoy = fecha === hoy;

  const irA = (destino: string) =>
    router.push(destino === hoy ? "/hoy" : `/hoy?fecha=${destino}`);

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => irA(sumarDias(fecha, -1))}
        aria-label="Día anterior"
        className="-ml-2 flex size-9 items-center justify-center rounded-lg text-muted"
      >
        <Flecha direccion="izquierda" />
      </button>

      <label className="relative flex-1 text-center">
        <span className="text-sm text-muted">
          {esHoy ? "Hoy" : enPalabras(fecha)}
        </span>
        {/* El input cubre la etiqueta: al tocarla se abre el selector nativo. */}
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => e.target.value && irA(e.target.value)}
          aria-label="Elegir día"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <button
        type="button"
        onClick={() => irA(sumarDias(fecha, 1))}
        disabled={esHoy}
        aria-label="Día siguiente"
        className="-mr-2 flex size-9 items-center justify-center rounded-lg text-muted disabled:opacity-25"
      >
        <Flecha direccion="derecha" />
      </button>
    </div>
  );
}

function Flecha({ direccion }: { direccion: "izquierda" | "derecha" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d={direccion === "izquierda" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
