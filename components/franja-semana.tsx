"use client";

import { useRouter } from "next/navigation";

const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];
const DIA_MS = 86_400_000;

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/**
 * La semana arriba de Hoy: siete días, el elegido relleno, un punto en los que
 * tienen comidas.
 *
 * Es la forma más corta de moverse por el diario: un toque para ir a un día de
 * esta semana, y las flechas de los costados saltan de semana. No se puede ir
 * a un día futuro: estaría siempre vacío.
 */
export function FranjaSemana({
  semana,
  fecha,
  hoy,
  registrados,
}: {
  semana: string[];
  fecha: string;
  hoy: string;
  registrados: string[];
}) {
  const router = useRouter();
  const conRegistro = new Set(registrados);

  const irA = (destino: string) => router.push(destino === hoy ? "/hoy" : `/hoy?fecha=${destino}`);

  const hayDespues = semana[6] < hoy;
  const saltarSemana = (semanas: number) => {
    const destino = sumarDias(fecha, semanas * 7);
    irA(destino > hoy ? hoy : destino);
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Semana">
      <button
        type="button"
        onClick={() => saltarSemana(-1)}
        aria-label="Semana anterior"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <Flecha izquierda />
      </button>

      <div className="grid flex-1 grid-cols-7">
        {semana.map((dia, i) => {
          const elegido = dia === fecha;
          const futuro = dia > hoy;
          const esHoy = dia === hoy;
          return (
            <button
              key={dia}
              type="button"
              disabled={futuro}
              onClick={() => irA(dia)}
              aria-label={dia}
              aria-current={elegido ? "date" : undefined}
              className="entra flex flex-col items-center gap-1 py-1 disabled:opacity-35"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="text-xs text-muted">{INICIALES[i]}</span>
              <span
                className={`flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  elegido
                    ? "bg-accent text-sobre-accent"
                    : esHoy
                      ? "text-accent"
                      : "text-ink"
                }`}
              >
                {Number(dia.slice(8))}
              </span>
              <span
                className={`size-1.5 rounded-full transition-colors ${
                  conRegistro.has(dia) ? "bg-accent" : "bg-hairline"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => saltarSemana(1)}
        disabled={!hayDespues}
        aria-label="Semana siguiente"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-25"
      >
        <Flecha />
      </button>
    </div>
  );
}

function Flecha({ izquierda }: { izquierda?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d={izquierda ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
