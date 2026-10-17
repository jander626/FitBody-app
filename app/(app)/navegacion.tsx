"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Barra inferior flotante.
 *
 * Cuatro destinos y el "+" en el medio, más grande: registrar es lo que se usa
 * cuatro veces al día; lo demás se consulta. El perfil dejó la barra y vive en
 * el círculo de arriba a la derecha de Hoy: seis destinos eran demasiados para
 * un pulgar, y los ajustes se tocan una vez al mes.
 *
 * Una pastilla de color sigue a la pantalla activa y se desliza de un destino a
 * otro: es la señal de "estás aquí", y el movimiento hace que cambiar de
 * pantalla se sienta como un solo gesto continuo.
 */
const IZQUIERDA = [
  { href: "/hoy", etiqueta: "Hoy", icono: AnilloIcono },
  { href: "/historial", etiqueta: "Historial", icono: CalendarioIcono },
] as const;

const DERECHA = [
  { href: "/consejos", etiqueta: "Consejos", icono: BrujulaIcono },
  { href: "/peso", etiqueta: "Peso", icono: CurvaIcono },
] as const;

/** Las cinco columnas, en orden; el "+" ocupa la del medio. */
const COLUMNAS = [...IZQUIERDA, null, ...DERECHA] as const;

export function NavegacionInferior() {
  const real = usePathname();
  // Al tocar un destino, la pastilla se mueve de una vez, sin esperar a que el
  // servidor entregue la pantalla. Lo pendiente vale solo hasta que la ruta
  // real cambie: si no se descartara ahí, volver al punto de partida (por
  // ejemplo cerrar Registrar) reviviría un destino viejo y escondería la barra.
  const [pendiente, setPendiente] = useState<{ href: string; desde: string } | null>(null);
  const [rutaVista, setRutaVista] = useState(real);
  if (rutaVista !== real) {
    setRutaVista(real);
    setPendiente(null);
  }
  const pathname = pendiente && pendiente.desde === real ? pendiente.href : real;
  const estaEn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Perfil y Garmin no tienen botón en la barra: ahí no hay ninguna activa y la
  // pastilla se esconde en vez de quedarse en un destino que no es.
  const indiceActivo = COLUMNAS.findIndex((c) => c !== null && estaEn(c.href));
  const registrando = estaEn("/registrar");

  // Registrar es una pantalla de captura con su propia barra de modos: la
  // general se esconde para no apilar dos barras una sobre otra.
  // Lo mismo al corregir una comida: ahí manda la barra de guardar.
  if (registrando || estaEn("/comida")) return null;

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 z-10 mx-auto max-w-md px-4"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="relative grid grid-cols-5 items-center rounded-full border border-hairline bg-surface/90 px-1.5 py-1.5 shadow-[var(--shadow)] backdrop-blur-md">
        {/* La pastilla: una columna de ancho, se desliza con transform. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-1.5 rounded-full bg-accent-soft transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{
            width: "calc((100% - 0.75rem) / 5)",
            transform: `translateX(${Math.max(indiceActivo, 0) * 100}%)`,
            opacity: indiceActivo === -1 ? 0 : 1,
          }}
        />

        {COLUMNAS.map((destino, i) =>
          destino === null ? (
            <Link
              key="registrar"
              href="/registrar"
              onClick={() => setPendiente({ href: "/registrar", desde: real })}
              aria-label="Registrar"
              className="relative -my-5 mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-sobre-accent shadow-[var(--shadow)]"
            >
              <MasIcono />
            </Link>
          ) : (
            <Link
              key={destino.href}
              href={destino.href}
              onClick={() => setPendiente({ href: destino.href, desde: real })}
              aria-current={i === indiceActivo ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 rounded-full py-2 text-[10px] transition-colors ${
                i === indiceActivo ? "font-medium text-accent" : "text-muted"
              }`}
            >
              <destino.icono />
              {destino.etiqueta}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

/* Iconos en línea: cuatro trazos no justifican una dependencia. */

function AnilloIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path
        d="M12 4a8 8 0 0 1 6.9 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MasIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarioIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <rect
        x="3.5" y="5" width="17" height="15" rx="2.5"
        stroke="currentColor" strokeWidth="2"
      />
      <path
        d="M3.5 9.5h17M8 3.5v3M16 3.5v3"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}

function CurvaIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M4 16.5c3-1 5-6 8-6s5 3 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrujulaIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15 9l-2 4.2-4 1.8 2-4.2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
