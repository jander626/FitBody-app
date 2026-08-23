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
  { href: "/registrar", etiqueta: "Registrar", icono: MasIcono, principal: true },
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
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  activo ? "text-accent" : "text-muted"
                }`}
              >
                <span
                  className={
                    principal
                      ? "flex size-9 items-center justify-center rounded-full bg-accent text-white"
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
