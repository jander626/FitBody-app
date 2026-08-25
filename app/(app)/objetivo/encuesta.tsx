"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Aviso, Campo, Dato, Encabezado, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import {
  ACTIVIDADES,
  METAS,
  ORDEN_ACTIVIDADES,
  ORDEN_METAS,
  ORDEN_RITMOS,
  RITMOS,
  parametrosDe,
  type Meta,
  type NivelActividad,
  type Ritmo,
} from "@/lib/nutrition/metas";
import { calcularPlan } from "@/lib/nutrition";
import { guardarPerfil, type ResultadoGuardar } from "../perfil/acciones";

/**
 * La encuesta que arma el plan.
 *
 * Una pregunta por pantalla, en las palabras de quien contesta. El formulario
 * de Perfil sigue existiendo para quien quiera mover los números a mano; esto
 * es el camino para quien no sabe —ni tiene por qué saber— qué es un factor de
 * actividad de 1.375.
 *
 * El plan se calcula acá mismo mientras se contesta, con el mismo motor que
 * usa el servidor. Ver el número antes de guardarlo es lo que convierte esto
 * en una decisión en vez de un trámite: si salen 1500 kcal, querés saberlo
 * antes de comprometerte, no después.
 *
 * Guarda por la misma acción que el formulario de Perfil. Dos caminos de
 * escritura para el mismo dato terminan divergiendo.
 */

interface Datos {
  edad: number | null;
  sexo: "hombre" | "mujer" | null;
  estaturaCm: number | null;
  pesoKg: number | null;
}

type Paso = "meta" | "actividad" | "ritmo" | "datos" | "plan";

export function Encuesta({ datosPrevios }: { datosPrevios: Datos }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [actividad, setActividad] = useState<NivelActividad | null>(null);
  const [ritmo, setRitmo] = useState<Ritmo | null>(null);
  const [datos, setDatos] = useState<Datos>(datosPrevios);
  const [paso, setPaso] = useState<Paso>("meta");

  const [resultado, guardar, guardando] = useActionState<
    ResultadoGuardar | null,
    FormData
  >(guardarPerfil, null);

  const definicion = meta ? METAS[meta] : null;

  /** Los pasos que toca recorrer: el ritmo solo aparece donde tiene sentido. */
  const pasos: Paso[] = [
    "meta",
    "actividad",
    ...(definicion?.preguntaRitmo ? (["ritmo"] as Paso[]) : []),
    "datos",
    "plan",
  ];
  const indice = pasos.indexOf(paso);

  const completo =
    datos.edad !== null &&
    datos.sexo !== null &&
    datos.estaturaCm !== null &&
    datos.pesoKg !== null;

  const plan =
    meta && actividad && completo
      ? (() => {
          const p = parametrosDe({
            meta,
            actividad,
            ...(ritmo ? { ritmo } : {}),
          });
          return {
            parametros: p,
            calculo: calcularPlan(
              {
                sexo: datos.sexo!,
                edad: datos.edad!,
                estaturaCm: datos.estaturaCm!,
                pesoKg: datos.pesoKg!,
              },
              p.factorActividad,
              p.objetivo,
              p.deficitPct,
              p.opciones,
            ),
          };
        })()
      : null;

  const avanzar = () => setPaso(pasos[Math.min(indice + 1, pasos.length - 1)]);
  const volver = () => setPaso(pasos[Math.max(indice - 1, 0)]);

  return (
    <>
      <Encabezado
        titulo="Tu objetivo"
        bajada={`Paso ${indice + 1} de ${pasos.length}`}
      />

      <div className="space-y-6 px-5">
        {/* Una barra fina en vez de puntos: con cuatro o cinco pasos los
            puntos se leen peor que una línea que avanza. */}
        <div
          className="h-1 overflow-hidden rounded-full bg-hairline-soft"
          role="img"
          aria-label={`Paso ${indice + 1} de ${pasos.length}`}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${((indice + 1) / pasos.length) * 100}%` }}
          />
        </div>

        {paso === "meta" && (
          <Pregunta titulo="¿Qué querés lograr?">
            {ORDEN_METAS.map((id) => (
              <Opcion
                key={id}
                titulo={METAS[id].titulo}
                detalle={METAS[id].resumen}
                elegida={meta === id}
                onElegir={() => {
                  setMeta(id);
                  if (!METAS[id].preguntaRitmo) setRitmo(null);
                  setPaso("actividad");
                }}
              />
            ))}
          </Pregunta>
        )}

        {paso === "actividad" && (
          <Pregunta
            titulo="¿Cuánto te movés en una semana?"
            ayuda="Ante la duda, elegí el de abajo. Sobrestimar cuánto te movés infla el objetivo y hace que el plan no funcione sin que se entienda por qué."
          >
            {ORDEN_ACTIVIDADES.map((id) => (
              <Opcion
                key={id}
                titulo={ACTIVIDADES[id].titulo}
                detalle={ACTIVIDADES[id].detalle}
                elegida={actividad === id}
                onElegir={() => {
                  setActividad(id);
                  avanzar();
                }}
              />
            ))}
          </Pregunta>
        )}

        {paso === "ritmo" && (
          <Pregunta titulo="¿A qué ritmo?">
            {ORDEN_RITMOS.map((id) => (
              <Opcion
                key={id}
                titulo={RITMOS[id].titulo}
                detalle={RITMOS[id].detalle}
                elegida={ritmo === id}
                onElegir={() => {
                  setRitmo(id);
                  avanzar();
                }}
              />
            ))}
          </Pregunta>
        )}

        {paso === "datos" && (
          <Pregunta
            titulo="Tus datos"
            ayuda="Hacen falta para calcular cuánto gastás. No salen de acá."
          >
            <Tarjeta className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Edad">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={120}
                    value={datos.edad ?? ""}
                    onChange={(e) =>
                      setDatos((d) => ({ ...d, edad: numero(e.target.value) }))
                    }
                    className={claseControl}
                  />
                </Campo>
                <Campo etiqueta="Sexo">
                  <select
                    value={datos.sexo ?? ""}
                    onChange={(e) =>
                      setDatos((d) => ({
                        ...d,
                        sexo: (e.target.value || null) as Datos["sexo"],
                      }))
                    }
                    className={claseControl}
                  >
                    <option value="">Elegí</option>
                    <option value="hombre">Hombre</option>
                    <option value="mujer">Mujer</option>
                  </select>
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Estatura" ayuda="cm">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={100}
                    max={250}
                    value={datos.estaturaCm ?? ""}
                    onChange={(e) =>
                      setDatos((d) => ({ ...d, estaturaCm: numero(e.target.value) }))
                    }
                    className={claseControl}
                  />
                </Campo>
                <Campo etiqueta="Peso de hoy" ayuda="kg">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    min={20}
                    max={400}
                    value={datos.pesoKg ?? ""}
                    onChange={(e) =>
                      setDatos((d) => ({ ...d, pesoKg: numero(e.target.value) }))
                    }
                    className={claseControl}
                  />
                </Campo>
              </div>
            </Tarjeta>

            <button
              type="button"
              onClick={avanzar}
              disabled={!completo}
              className="w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
            >
              Ver mi plan
            </button>
            {!completo && (
              <p className="text-xs text-muted">Faltan datos por completar.</p>
            )}
          </Pregunta>
        )}

        {paso === "plan" && plan && definicion && (
          <div className="space-y-4">
            <div>
              <TituloSeccion>Tu plan</TituloSeccion>
              <Tarjeta>
                <Dato
                  etiqueta="Objetivo diario"
                  valor={plan.calculo.kcalObjetivo}
                  detalle="kcal"
                />
                <div className="my-2 border-t border-hairline-soft" />
                <Dato etiqueta="Proteína" valor={plan.calculo.proteinaG} detalle="g" />
                <Dato etiqueta="Carbohidratos" valor={plan.calculo.carbsG} detalle="g" />
                <Dato etiqueta="Grasa" valor={plan.calculo.grasaG} detalle="g" />
                <div className="my-2 border-t border-hairline-soft" />
                <Dato
                  etiqueta="Gasto estimado"
                  valor={plan.calculo.tdeeKcal}
                  detalle="kcal/día"
                />
                <Dato
                  etiqueta="Ritmo esperado"
                  valor={`${plan.calculo.ritmoEsperadoKgSemana.min.toFixed(2)} a ${plan.calculo.ritmoEsperadoKgSemana.max.toFixed(2)}`}
                  detalle="kg/semana"
                />
              </Tarjeta>
            </div>

            <Aviso nivel="info">{definicion.expectativa}</Aviso>

            {plan.calculo.avisos.map((aviso, i) => (
              <Aviso key={i} nivel={aviso.nivel}>
                {aviso.mensaje}
              </Aviso>
            ))}

            <form action={guardar}>
              <input type="hidden" name="edad" value={datos.edad ?? ""} />
              <input type="hidden" name="sexo" value={datos.sexo ?? ""} />
              <input type="hidden" name="estaturaCm" value={datos.estaturaCm ?? ""} />
              <input type="hidden" name="pesoKg" value={datos.pesoKg ?? ""} />
              <input type="hidden" name="objetivo" value={plan.parametros.objetivo} />
              <input
                type="hidden"
                name="factorActividad"
                value={plan.parametros.factorActividad}
              />
              <input type="hidden" name="deficitPct" value={plan.parametros.deficitPct} />
              <input
                type="hidden"
                name="proteinaGPorKg"
                value={plan.parametros.opciones.proteinaGPorKg}
              />
              <input
                type="hidden"
                name="grasaGPorKg"
                value={plan.parametros.opciones.grasaGPorKg}
              />
              <button
                type="submit"
                disabled={guardando}
                className="w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Usar este plan"}
              </button>
            </form>

            {resultado?.ok === true && (
              <Aviso nivel="bien">
                Listo: tu objetivo quedó en {resultado.kcal} kcal.{" "}
                <Link href="/hoy" className="underline underline-offset-4">
                  Ir a Hoy
                </Link>
              </Aviso>
            )}
            {resultado?.ok === false && (
              <Aviso nivel="error">{resultado.error}</Aviso>
            )}

            <p className="text-xs text-muted">
              Esto es un cálculo, no una verdad. Es un punto de partida: la app
              lo va a ajustar sola con lo que muestre la balanza en dos semanas.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pb-4">
          {indice > 0 ? (
            <button
              type="button"
              onClick={volver}
              className="py-2 text-sm text-muted"
            >
              Atrás
            </button>
          ) : (
            <span />
          )}
          <Link href="/perfil" className="py-2 text-sm text-muted">
            {paso === "plan" ? "Ajustar a mano" : "Cancelar"}
          </Link>
        </div>
      </div>
    </>
  );
}

function numero(valor: string): number | null {
  const n = Number(valor);
  return valor === "" || !Number.isFinite(n) ? null : n;
}

function Pregunta({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-serif text-xl text-ink">{titulo}</h2>
        {ayuda && <p className="mt-1 text-sm text-muted">{ayuda}</p>}
      </div>
      {children}
    </div>
  );
}

function Opcion({
  titulo,
  detalle,
  elegida,
  onElegir,
}: {
  titulo: string;
  detalle: string;
  elegida: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={elegida}
      className={`block w-full rounded-xl border px-4 py-3 text-left ${
        elegida
          ? "border-accent bg-accent-soft"
          : "border-hairline bg-surface"
      }`}
    >
      <span className="block text-base font-medium text-ink">{titulo}</span>
      <span className="mt-0.5 block text-sm text-muted">{detalle}</span>
    </button>
  );
}
