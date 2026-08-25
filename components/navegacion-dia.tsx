"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Moverse entre días del diario.
 *
 * En el celular escribir una fecha en la URL no es una opción, así que hacen
 * falta las flechas. La fecha lleva al historial, donde el calendario muestra
 * de un vistazo qué días tienen registro y cómo salió cada uno.
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

      <Link
        href="/historial"
        aria-label="Ver el historial y elegir otro día"
        className="flex-1 py-1 text-center text-sm text-muted underline-offset-4 hover:underline"
      >
        {esHoy ? "Hoy" : enPalabras(fecha)}
      </Link>

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
