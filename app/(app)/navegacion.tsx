"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra inferior fija.
 *
 * Registrar va al medio y con más peso visual porque es lo que se usa cuatro
 * veces al día; lo demás se consulta. El objetivo del plan es que llegar a la
 * cámara cueste como máximo dos toques — desde acá cuesta uno.
 */
const DESTINOS = [
  { href: "/hoy", etiqueta: "Hoy", icono: AnilloIcono },
  { href: "/historial", etiqueta: "Historial", icono: CalendarioIcono },
  { href: "/registrar", etiqueta: "Registrar", icono: MasIcono, principal: true },
  { href: "/consejos", etiqueta: "Consejos", icono: BrujulaIcono },
  { href: "/peso", etiqueta: "Peso", icono: CurvaIcono },
  { href: "/perfil", etiqueta: "Perfil", icono: PersonaIcono },
] as const;

export function NavegacionInferior() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-hairline bg-surface/95 backdrop-blur"
    >
      <ul className="flex items-stretch justify-around">
        {DESTINOS.map(({ href, etiqueta, icono: Icono, ...resto }) => {
          const activo = pathname === href || pathname.startsWith(`${href}/`);
          const principal = "principal" in resto && resto.principal;

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-0.5 py-2.5 text-[10px] transition-colors ${
                  activo ? "text-accent" : "text-muted"
                }`}
              >
                <span
                  className={
                    principal
                      ? "flex size-9 items-center justify-center rounded-full bg-accent text-sobre-accent"
                      : "flex size-9 items-center justify-center"
                  }
                >
                  <Icono />
                </span>
                <span className={activo ? "font-medium" : undefined}>
                  {etiqueta}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
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
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
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

function PersonaIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 19.5a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
