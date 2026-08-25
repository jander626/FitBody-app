import Link from "next/link";
import { Aviso, Tarjeta, TituloSeccion } from "@/components/ui";
import { NavegacionDia } from "@/components/navegacion-dia";
import { Medidor, estadoMacro, type EstadoMedidor } from "@/components/medidor";
import type { ComidaDiario, Dia } from "@/lib/datos/diario";

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

export function VistaHoy({
  dia,
  esHoy,
  hoy,
}: {
  dia: Dia;
  esHoy: boolean;
  hoy: string;
}) {
  const { totales, objetivo, comidas } = dia;

  const restantes = objetivo ? objetivo.kcal - totales.kcal : null;
  const excedido = restantes !== null && restantes < 0;

  const estadoKcal: EstadoMedidor = !objetivo
    ? "progreso"
    : totales.kcal > objetivo.kcal * 1.05
      ? "excedido"
      : "progreso";

  return (
    <>
      {/* Cabecera: el número grande es la respuesta a "¿cuánto me queda?".
          Va en la sans y con cifras proporcionales — la serif y las cifras
          tabulares son para los títulos y las columnas, no para esto. */}
      <header className="px-5 pt-8 pb-5">
        <NavegacionDia fecha={dia.fecha} hoy={hoy} />

        {objetivo ? (
          <>
            <p className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-5xl font-semibold tracking-tight ${
                  excedido ? "text-bad" : "text-ink"
                }`}
              >
                {Math.abs(Math.round(restantes!))}
              </span>
              <span className="text-base text-muted">
                kcal {excedido ? "de más" : "restantes"}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {Math.round(totales.kcal)} de {objetivo.kcal} kcal
            </p>
          </>
        ) : (
          <p className="mt-1 text-2xl text-ink">
            {Math.round(totales.kcal)}{" "}
            <span className="text-base text-muted">kcal</span>
          </p>
        )}
      </header>

      <div className="space-y-6 px-5">
        {!objetivo && (
          <Aviso nivel="info">
            Todavía no hay un objetivo configurado. Andá a Perfil para calcular
            tu plan y ver cuánto te queda cada día.
          </Aviso>
        )}

        {objetivo && (
          <Tarjeta>
            <Medidor
              etiqueta="Calorías"
              valor={totales.kcal}
              objetivo={objetivo.kcal}
              unidad="kcal"
              estado={estadoKcal}
            />
            <div className="my-1 border-t border-hairline-soft" />
            <Medidor
              etiqueta="Proteína"
              valor={totales.proteinaG}
              objetivo={objetivo.proteinaG}
              unidad="g"
              minimo
              estado={estadoMacro(totales.proteinaG, objetivo.proteinaG, true)}
            />
            <Medidor
              etiqueta="Carbohidratos"
              valor={totales.carbsG}
              objetivo={objetivo.carbsG}
              unidad="g"
              estado={estadoMacro(totales.carbsG, objetivo.carbsG, false)}
            />
            <Medidor
              etiqueta="Grasa"
              valor={totales.grasaG}
              objetivo={objetivo.grasaG}
              unidad="g"
              estado={estadoMacro(totales.grasaG, objetivo.grasaG, false)}
            />
            <p className="mt-2 text-xs text-muted">
              La proteína se persigue hacia arriba; el resto son techos.
            </p>
          </Tarjeta>
        )}

        <div>
          <TituloSeccion>
            {comidas.length === 0
              ? "Sin comidas registradas"
              : `${comidas.length} ${comidas.length === 1 ? "comida" : "comidas"}`}
          </TituloSeccion>

          {comidas.length === 0 ? (
            <Tarjeta>
              <p className="text-sm text-ink-2">
                Todavía no registraste nada{esHoy ? " hoy" : " este día"}.
              </p>
              <Link
                href="/registrar"
                className="mt-3 block rounded-xl bg-accent px-4 py-3 text-center text-base font-medium text-white"
              >
                Registrar una comida
              </Link>
            </Tarjeta>
          ) : (
            <div className="space-y-3">
              {comidas.map((comida) => (
                <TarjetaComida key={comida.id} comida={comida} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TarjetaComida({ comida }: { comida: ComidaDiario }) {
  return (
    <Tarjeta>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-ink">
          {NOMBRE_MOMENTO[comida.momento] ?? comida.momento}
          {comida.hora && (
            <span className="ml-2 text-xs font-normal text-muted">
              {comida.hora.slice(0, 5)}
            </span>
          )}
        </h3>
        <span className="font-mono text-sm text-ink tabular-nums">
          {Math.round(comida.subtotal.kcal)}
          <span className="text-muted"> kcal</span>
        </span>
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
    </Tarjeta>
  );
}
