"use client";

import { createPortal } from "react-dom";
import { FranjaSoloLectura } from "./franja-solo-lectura";
import { MedidorDia } from "./medidor-dia";
import { useCuenta } from "./movimiento";
import { useHidratado } from "./hidratado";
import type { Totales } from "@/lib/registro/tipos";

/**
 * Lo que se ve justo después de guardar una comida.
 *
 * Es el momento de recompensa de la app, y está pensado para sentirse como uno:
 * si es la primera comida del día, se enciende la racha y se marca el día en la
 * semana; si no, un visto bueno y nada más. Debajo, el día hasta ahora con la
 * comida recién sumada: el arco ya estaba lleno hasta donde estabas y solo se
 * dibuja lo nuevo, para que se sienta cuánto aportó.
 *
 * Sustituye al salto directo a Hoy, que guardaba en silencio: sin esta pantalla
 * no había ninguna señal de que algo había pasado salvo que cambiara un número
 * en otra pantalla.
 */
export function PantallaRegistrada({
  primeraDelDia,
  racha,
  semana,
  registrados,
  hoy,
  antes,
  despues,
  objetivo,
  onContinuar,
}: {
  primeraDelDia: boolean;
  /** Días seguidos que había antes de esta comida, sin contar hoy. */
  racha: number;
  semana: string[];
  registrados: string[];
  hoy: string;
  antes: Totales;
  despues: Totales;
  objetivo: Totales | null;
  onContinuar: () => void;
}) {
  const hidratado = useHidratado();
  // Si hoy ya tenía comidas, la racha no cambia; si no, esta comida la sube.
  const nueva = primeraDelDia ? racha + 1 : racha;
  const animada = useCuenta(nueva, 700);

  if (!hidratado) return null;

  return createPortal(
    <div className="pop fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ground">
      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6"
        style={{ paddingTop: "calc(2.5rem + env(safe-area-inset-top))", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="text-center">
          {primeraDelDia ? (
            <>
              <p className="respira text-8xl" aria-hidden="true">
                🔥
              </p>
              <p className="pop mt-2 font-mono text-6xl font-semibold text-ink tabular-nums">{Math.round(animada)}</p>
              <h1 className="mt-2 font-serif text-2xl text-ink">
                {nueva === 1 ? "Día registrado" : `${nueva} días seguidos`}
              </h1>
              <div className="mt-6">
                <FranjaSoloLectura semana={semana} hoy={hoy} registrados={[...registrados, hoy]} />
              </div>
            </>
          ) : (
            <>
              <p className="pop text-7xl" aria-hidden="true">
                ✅
              </p>
              <h1 className="entra mt-3 font-serif text-2xl text-ink">Comida registrada</h1>
            </>
          )}
        </div>

        {objetivo && (
          <div className="entra mt-8 rounded-3xl border border-hairline bg-surface p-5 shadow-[var(--shadow)]" style={{ "--i": 3 } as React.CSSProperties}>
            <p className="mb-3 text-center text-sm text-muted">Tu día hasta ahora</p>
            <MedidorDia
              consumido={despues.kcal}
              anterior={antes.kcal}
              objetivo={objetivo.kcal}
              macros={[
                { etiqueta: "Proteínas", valor: despues.proteinaG, objetivo: objetivo.proteinaG, minimo: true, tono: "var(--macro-prot)" },
                { etiqueta: "Carbos", valor: despues.carbsG, objetivo: objetivo.carbsG, tono: "var(--macro-carb)" },
                { etiqueta: "Grasas", valor: despues.grasaG, objetivo: objetivo.grasaG, tono: "var(--macro-gras)" },
              ]}
            />
          </div>
        )}

        <div className="flex-1" />
        <button
          type="button"
          onClick={onContinuar}
          className="mt-8 w-full rounded-full bg-accent px-5 py-4 text-base font-semibold text-sobre-accent"
        >
          Continuar
        </button>
      </div>
    </div>,
    document.body,
  );
}
