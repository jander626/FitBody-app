import Link from "next/link";
import { Aviso, TituloSeccion } from "@/components/ui";
import { FotoAmpliable } from "@/components/foto-ampliable";
import { TarjetaConsejo } from "@/components/tarjeta-consejo";
import { FranjaSemana } from "@/components/franja-semana";
import { MedidorDia } from "@/components/medidor-dia";
import type { ComidaDiario, Dia } from "@/lib/datos/diario";
import type { Consejo } from "@/lib/coach/consejos";

const NOMBRE_MOMENTO: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  snack: "Snack",
  postre: "Postre",
  bebida: "Bebida",
  otro: "Otro",
};

/** Cómo se registró la comida, en una palabra. */
const NOMBRE_ORIGEN: Record<string, string> = {
  foto: "foto",
  descripcion: "texto",
  "foto+descripcion": "foto y texto",
  manual: "manual",
};

function formatearPorcion(item: {
  porcionG: number | null;
  porcionMl: number | null;
}): string | null {
  if (item.porcionG !== null) return `${Math.round(item.porcionG)} g`;
  if (item.porcionMl !== null) return `${Math.round(item.porcionMl)} ml`;
  // Sin porción: la cantidad va en el nombre ("3 huevos") o no significa nada
  // ("agua"). Mejor no mostrar nada que inventar un número.
  return null;
}

/** Las comidas que siempre se muestran, aunque estén vacías, y en este orden. */
const MOMENTOS_FIJOS = ["desayuno", "almuerzo", "cena", "snack"] as const;

const EMOJI_MOMENTO: Record<string, string> = {
  desayuno: "🍳",
  almuerzo: "🍽️",
  cena: "🌙",
  snack: "🍎",
  postre: "🍰",
  bebida: "🥤",
  otro: "➕",
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "martes 24 de ago" — sin el año, que en un diario diario sobra. */
function enPalabras(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function VistaHoy({
  dia,
  esHoy,
  hoy,
  semana,
  registrados,
  racha,
  consejo,
}: {
  dia: Dia;
  esHoy: boolean;
  hoy: string;
  /** Las siete fechas de la semana del día que se mira, lunes primero. */
  semana: string[];
  /** De esas fechas, las que tienen comidas. */
  registrados: string[];
  /** Días seguidos con registro, contando hasta hoy. */
  racha: number;
  /** El más urgente de la semana. Null en días pasados. */
  consejo: Consejo | null;
}) {
  const { totales, objetivo, comidas } = dia;

  // Lo que no es una de las cuatro comidas fijas (postre, bebida, otro) solo
  // aparece cuando hay algo registrado: una tarjeta vacía por cada una sería
  // ruido en una pantalla que se abre cuatro veces al día.
  const extras = [...new Set(comidas.map((c) => c.momento))].filter(
    (m) => !(MOMENTOS_FIJOS as readonly string[]).includes(m),
  );

  return (
    <>
      <header className="px-5 pt-6 pb-2">
        <div className="entra flex items-center justify-between gap-3">
          <Link
            href="/historial"
            aria-label="Ver el historial y elegir otro día"
            className="font-serif text-3xl text-ink"
          >
            {esHoy ? "Hoy" : enPalabras(dia.fecha)}
          </Link>
          <span className="ml-auto flex items-center gap-1 text-sm font-medium text-ink-2" aria-label={`Racha de ${racha} ${racha === 1 ? "día" : "días"}`}>
            <span className={racha > 0 ? "respira" : "opacity-30 grayscale"} aria-hidden="true">
              🔥
            </span>
            <span className="font-mono tabular-nums">{racha}</span>
          </span>
          <Link
            href="/perfil"
            aria-label="Perfil"
            className="flex size-11 items-center justify-center rounded-full border border-hairline bg-surface text-muted"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
              <path d="M5 19.5a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
        </div>

        <div className="mt-4">
          <FranjaSemana semana={semana} fecha={dia.fecha} hoy={hoy} registrados={registrados} />
        </div>
      </header>

      <div className="space-y-5 px-5 pt-3">
        {!objetivo ? (
          <div className="entra">
            <Aviso nivel="info">
              Todavía no hay un objetivo configurado. Sin él no se puede decir cuánto te queda cada día.
            </Aviso>
            <Link
              href="/objetivo"
              className="mt-3 block rounded-full bg-accent px-4 py-3.5 text-center text-base font-semibold text-sobre-accent"
            >
              Calcular mi plan
            </Link>
          </div>
        ) : (
          <div
            className="entra rounded-3xl border border-hairline bg-surface p-5 shadow-[var(--shadow)]"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            {/* La clave hace que el medidor se llene de nuevo al cambiar de
                día: ver crecer la barra es lo que le da peso al dato. */}
            <MedidorDia
              key={dia.fecha}
              consumido={totales.kcal}
              objetivo={objetivo.kcal}
              macros={[
                { etiqueta: "Proteínas", valor: totales.proteinaG, objetivo: objetivo.proteinaG, minimo: true, tono: "var(--macro-prot)" },
                { etiqueta: "Carbos", valor: totales.carbsG, objetivo: objetivo.carbsG, tono: "var(--macro-carb)" },
                { etiqueta: "Grasas", valor: totales.grasaG, objetivo: objetivo.grasaG, tono: "var(--macro-gras)" },
              ]}
            />
          </div>
        )}

        {consejo && (
          <div className="entra" style={{ "--i": 3 } as React.CSSProperties}>
            {/* Solo el más urgente. Los demás están en /consejos: una lista
                larga en la pantalla que se abre cuatro veces al día deja de
                leerse a los tres días. */}
            <TituloSeccion>Lo que dicen tus datos</TituloSeccion>
            <TarjetaConsejo consejo={consejo} />
            <Link href="/consejos" className="mt-2 block py-2 text-center text-sm text-muted">
              Ver todos los consejos
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {[...MOMENTOS_FIJOS, ...extras].map((momento, i) => (
            <SeccionComida
              key={momento}
              i={i + 4}
              momento={momento}
              comidas={comidas.filter((c) => c.momento === momento)}
              // El registro siempre es del día de hoy: ofrecer "+" en un día
              // pasado sería agregar la comida a otro día sin avisar.
              puedeAgregar={esHoy}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function SeccionComida({
  i,
  momento,
  comidas,
  puedeAgregar,
}: {
  i: number;
  momento: string;
  comidas: ComidaDiario[];
  puedeAgregar: boolean;
}) {
  const kcal = comidas.reduce((n, c) => n + c.subtotal.kcal, 0);
  const p = comidas.reduce((n, c) => n + c.subtotal.proteinaG, 0);
  const c = comidas.reduce((n, x) => n + x.subtotal.carbsG, 0);
  const g = comidas.reduce((n, x) => n + x.subtotal.grasaG, 0);
  const nombre = NOMBRE_MOMENTO[momento] ?? momento;

  return (
    <section
      className="entra rounded-3xl border border-hairline bg-surface p-4 shadow-[var(--shadow)]"
      style={{ "--i": i } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {EMOJI_MOMENTO[momento] ?? "🍴"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-ink">{nombre}</h2>
          <p className="font-mono text-xs text-muted tabular-nums">
            {Math.round(kcal)} kcal · {Math.round(p)}P {Math.round(c)}C {Math.round(g)}G
          </p>
        </div>
        {puedeAgregar && comidas.length > 0 && (
          <Link
            href={`/registrar?momento=${momento}`}
            aria-label={`Agregar al ${nombre.toLowerCase()}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl text-accent"
          >
            +
          </Link>
        )}
      </div>

      {comidas.length === 0 ? (
        puedeAgregar && (
          <Link
            href={`/registrar?momento=${momento}`}
            className="mt-3 flex items-center justify-center gap-2 rounded-full bg-hairline-soft py-3 text-sm font-medium text-ink-2"
          >
            <span className="text-lg leading-none">+</span> Agregar {nombre.toLowerCase()}
          </Link>
        )
      ) : (
        <div className="mt-3 space-y-4 border-t border-hairline-soft pt-3">
          {comidas.map((comida) => (
            <ComidaRegistrada key={comida.id} comida={comida} />
          ))}
        </div>
      )}
    </section>
  );
}

function ComidaRegistrada({ comida }: { comida: ComidaDiario }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        {comida.fotoUrl && (
          // Chica y cuadrada: acá alcanza para reconocer el plato. Tocarla la
          // abre a pantalla completa, que es cuando de verdad se necesita
          // mirarla — para juzgar si la porción estimada era la que había.
          <FotoAmpliable
            src={comida.fotoUrl}
            alt=""
            etiqueta={`Ver en grande la foto del ${(NOMBRE_MOMENTO[comida.momento] ?? comida.momento).toLowerCase()}`}
            loading="lazy"
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        )}

        <div className="flex flex-1 items-baseline justify-between gap-3">
          <h3 className="text-xs text-muted">
            {comida.hora ? comida.hora.slice(0, 5) : "Registrada"}
          </h3>
          <span className="font-mono text-sm text-ink tabular-nums">
            {Math.round(comida.subtotal.kcal)}
            <span className="text-muted"> kcal</span>
          </span>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {comida.items.map((item) => {
          const porcion = formatearPorcion(item);
          return (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <span className="text-sm text-ink-2">
                {item.alimento}
                {porcion && (
                  <span className="ml-1.5 text-xs text-muted">{porcion}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                {Math.round(item.kcal)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline-soft pt-2 text-xs text-muted">
        <span className="font-mono tabular-nums">
          {Math.round(comida.subtotal.proteinaG)}P ·{" "}
          {Math.round(comida.subtotal.carbsG)}C ·{" "}
          {Math.round(comida.subtotal.grasaG)}G
        </span>
        <span>{NOMBRE_ORIGEN[comida.origen] ?? comida.origen}</span>
        {comida.confianza && (
          <span
            className={
              comida.confianza === "baja" ? "text-warn" : undefined
            }
          >
            confianza {comida.confianza}
          </span>
        )}
        {comida.corregido && <span>corregida</span>}

        {/*
          Al final y discreto: corregir es frecuente, pero mirar el diario lo
          es más. Que se vea sin competirle a los números.
        */}
        <Link
          href={`/comida/${comida.id}`}
          className="ml-auto text-accent underline-offset-4 hover:underline"
        >
          Corregir
        </Link>
      </div>

      {comida.nota && (
        <p className="mt-2 text-xs leading-relaxed text-muted">{comida.nota}</p>
      )}
    </div>
  );
}
