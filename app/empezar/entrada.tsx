"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/ui";
import { MedidorSemicirculo } from "@/components/medidor-semicirculo";
import { Confeti, useCuenta } from "@/components/movimiento";
import { ProyeccionPeso } from "@/components/proyeccion-peso";
import { SelectorNumero } from "@/components/selector-numero";
import { DIETAS, ORDEN_DIETAS, ORDEN_FUERZA, type Dieta, type NivelFuerza } from "@/lib/entrada/dietas";
import { clienteNavegador } from "@/lib/supabase/cliente-navegador";
import { rehacerPlan } from "./acciones";
import {
  EntradaSchema,
  pesoMetaCoherente,
  planDeEntrada,
  preguntaPesoMeta,
  preguntaRitmo,
  semanasHastaMeta,
  EDAD_MINIMA,
  type Entrada as EntradaDatos,
} from "@/lib/entrada/entrada";
import {
  ACTIVIDADES,
  ORDEN_ACTIVIDADES,
  ORDEN_RITMOS,
  RITMOS,
  type Meta,
  type NivelActividad,
  type Ritmo,
} from "@/lib/nutrition/metas";

/**
 * El flujo de entrada: una pregunta por pantalla, plan y, al final, la cuenta.
 *
 * Va en este orden a propósito. Pedir el correo primero es pedirle a un
 * desconocido que confíe antes de recibir nada; verle su número primero es
 * darle algo que ya es suyo. El correo llega cuando ya hay algo que guardar.
 *
 * Es deliberadamente dinámico: elegir avanza solo, cada pantalla entra
 * deslizándose desde el lado al que se va, los números se deslizan en vez de
 * teclearse, y el plan "se calcula" con su pequeña espera. Nada de eso cambia
 * el resultado; cambia cómo se siente llegar a él, que es lo que decide si
 * alguien termina la encuesta.
 *
 * Las respuestas se guardan en el navegador mientras se contesta, para que
 * recargar o volver de otra app no obligue a empezar de cero. Y viajan con el
 * enlace de acceso (metadatos del usuario) para aplicarse al crear la cuenta,
 * porque quien abre el correo puede hacerlo en otro navegador, donde el
 * borrador local no existe.
 */

type Paso =
  | "meta"
  | "actividad"
  | "ritmo"
  | "sexo"
  | "edad"
  | "estatura"
  | "peso"
  | "pesoMeta"
  | "reloj"
  | "salud"
  | "dieta"
  | "fuerza"
  | "creando"
  | "plan"
  | "proyeccion"
  | "cuenta";

/** Los pasos que cuentan como "preguntas" en la barra de progreso. */
const PREGUNTAS: Paso[] = [
  "meta",
  "actividad",
  "ritmo",
  "sexo",
  "edad",
  "estatura",
  "peso",
  "pesoMeta",
  "reloj",
  "salud",
  "dieta",
  "fuerza",
];

const CLAVE_BORRADOR = "fitfood-entrada-v2";

const METAS_ENTRADA: { id: Meta; emoji: string; titulo: string; detalle: string }[] = [
  { id: "bajar_grasa", emoji: "🔥", titulo: "Bajar de peso", detalle: "Perder grasa a un ritmo que se sostenga." },
  { id: "tonificar", emoji: "💪", titulo: "Tonificar", detalle: "Bajar grasa despacio sin perder músculo." },
  { id: "mantener", emoji: "❤️", titulo: "Mantener mi peso", detalle: "Quedarme donde estoy y comer mejor." },
  { id: "ganar_musculo", emoji: "🏋️", titulo: "Ganar músculo", detalle: "Subir de peso entrenando fuerza." },
];

const EMOJI_ACTIVIDAD: Record<NivelActividad, string> = {
  sedentario: "🛋️",
  poco: "🚶",
  moderado: "🏃",
  alto: "🏋️",
  muy_alto: "⚡",
};

const EMOJI_FUERZA: Record<NivelFuerza, string> = { ninguna: "🚶", "1-2": "💪", "3-4": "🏋️", "5+": "🔥" };
const NOMBRE_FUERZA: Record<NivelFuerza, string> = {
  ninguna: "No hago fuerza",
  "1-2": "1 o 2 veces",
  "3-4": "3 o 4 veces",
  "5+": "5 o más veces",
};

const EMOJI_RITMO: Record<Ritmo, string> = { suave: "🐢", normal: "🚶", rapido: "🐇" };

const EXPECTATIVA: Record<Meta, string> = {
  bajar_grasa:
    "Comerás un poco menos de lo que gastas. Con proteína alta y algo de entrenamiento, lo que baja es sobre todo grasa.",
  tonificar:
    "Es bajar de peso despacio y con la proteína más alta. La balanza casi no se mueve; lo que cambia es cómo te queda la ropa, y toma meses.",
  mantener: "Comerás lo que gastas. El registro sirve para ver qué comes, no para cambiarlo.",
  ganar_musculo:
    "Comerás un poco más de lo que gastas. Parte de lo que subas será grasa: no hay forma de evitarlo del todo.",
};

interface Borrador {
  meta: Meta | null;
  actividad: NivelActividad | null;
  ritmo: Ritmo | null;
  sexo: "hombre" | "mujer" | null;
  edad: number;
  estatura: number;
  peso: number;
  /** Null = sin peso objetivo (lo omitió o no aplica). */
  pesoMeta: number | null;
  condicion: boolean | null;
  dieta: Dieta;
  /** Cuántas veces a la semana entrena fuerza. Null = aún no contestó. */
  fuerza: NivelFuerza | null;
  /** ¿Tiene un reloj que mide cuánto gasta? Null = aún no contestó. */
  reloj: boolean | null;
  /** Su gasto diario medido, si dijo que sí. */
  gasto: number | null;
}

const VACIO: Borrador = {
  meta: null,
  actividad: null,
  ritmo: null,
  sexo: null,
  edad: 30,
  estatura: 170,
  peso: 70,
  pesoMeta: null,
  condicion: null,
  dieta: "recomendada",
  fuerza: null,
  reloj: null,
  gasto: null,
};

function leerBorrador(): Borrador {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR);
    return crudo ? { ...VACIO, ...JSON.parse(crudo), condicion: null } : VACIO;
  } catch {
    return VACIO;
  }
}

/** Las respuestas como las entiende el motor; null mientras falte algo. */
function armarEntrada(b: Borrador, conGasto: boolean): EntradaDatos | null {
  if (!b.meta || !b.actividad || !b.sexo) return null;
  const analisis = EntradaSchema.safeParse({
    meta: b.meta,
    actividad: b.actividad,
    ...(b.ritmo && preguntaRitmo(b.meta) ? { ritmo: b.ritmo } : {}),
    sexo: b.sexo,
    edad: b.edad,
    estaturaCm: b.estatura,
    pesoKg: b.peso,
    ...(b.pesoMeta !== null && preguntaPesoMeta(b.meta) ? { pesoMetaKg: b.pesoMeta } : {}),
    // Con una condición de salud solo se ofrece la forma recomendada: keto o
    // alta en proteína no son para cualquiera.
    dieta: b.condicion ? "recomendada" : b.dieta,
    ...(b.fuerza !== null ? { fuerza: b.fuerza } : {}),
    ...(conGasto && b.reloj && b.gasto !== null ? { gastoMedidoKcal: b.gasto } : {}),
  });
  return analisis.success ? analisis.data : null;
}

/** Peso objetivo sugerido: algo alcanzable, para que arrastrar sea afinar. */
function metaSugerida(meta: Meta, peso: number): number {
  return meta === "ganar_musculo" ? Math.round(peso * 1.06) : Math.round(peso * 0.92);
}

/** Lo que ya se sabe de quien rehace el plan: así no repite su estatura. */
interface Inicial {
  sexo: "hombre" | "mujer" | null;
  edad: number | null;
  estatura: number | null;
  peso: number | null;
}

export function Entrada({ rehacer = false, inicial }: { rehacer?: boolean; inicial?: Inicial }) {
  const router = useRouter();
  const [b, setB] = useState<Borrador>(() => ({
    ...VACIO,
    ...(inicial?.sexo ? { sexo: inicial.sexo } : {}),
    ...(inicial?.edad ? { edad: Math.min(90, Math.max(EDAD_MINIMA, inicial.edad)) } : {}),
    ...(inicial?.estatura ? { estatura: Math.min(220, Math.max(130, Math.round(inicial.estatura))) } : {}),
    ...(inicial?.peso ? { peso: Math.min(200, Math.max(40, Math.round(inicial.peso * 2) / 2)) } : {}),
  }));
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>("meta");
  const [direccion, setDireccion] = useState<"adelante" | "atras">("adelante");
  const [listo, setListo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El borrador se lee después de montar: leerlo durante el render daría un
  // HTML distinto en servidor y cliente.
  useEffect(() => {
    // Al rehacer el plan se parte de lo que ya se sabe, no de un borrador viejo.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, que solo existe en el cliente
    if (!rehacer) setB(leerBorrador());
    setListo(true);
  }, [rehacer]);

  useEffect(() => {
    if (!listo || rehacer) return;
    try {
      // La condición de salud no se guarda ni en el borrador: solo vive en la
      // pantalla mientras se usa para mostrar el aviso.
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ ...b, condicion: null }));
    } catch {
      // Sin almacenamiento (ventana privada) el flujo sigue funcionando.
    }
  }, [b, listo, rehacer]);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const cambiar = (parte: Partial<Borrador>) => setB((previo) => ({ ...previo, ...parte }));

  const entrada = useMemo(() => armarEntrada(b, true), [b]);
  // El gasto que daría la fórmula sin reloj: de ahí parte el deslizador, para
  // que arranque cerca de la respuesta y arrastrar sea afinar.
  const gastoFormula = useMemo(() => {
    const e = armarEntrada(b, false);
    return e ? planDeEntrada(e).calculo.tdeeKcal : 2200;
  }, [b]);

  const plan = useMemo(() => (entrada ? planDeEntrada(entrada) : null), [entrada]);

  const semanas = useMemo(
    () =>
      entrada && plan && entrada.pesoMetaKg !== undefined
        ? semanasHastaMeta(entrada.pesoKg, entrada.pesoMetaKg, plan.calculo.ritmoEsperadoKgSemana)
        : null,
    [entrada, plan],
  );

  const pasos: Paso[] = useMemo(
    () => [
      "meta",
      "actividad",
      ...(b.meta && preguntaRitmo(b.meta) ? (["ritmo"] as Paso[]) : []),
      "sexo",
      "edad",
      "estatura",
      "peso",
      ...(b.meta && preguntaPesoMeta(b.meta) ? (["pesoMeta"] as Paso[]) : []),
      "reloj",
      "salud",
      ...(b.condicion ? [] : (["dieta"] as Paso[])),
      "fuerza",
      "creando",
      "plan",
      ...(semanas !== null ? (["proyeccion"] as Paso[]) : []),
      // Rehaciendo el plan ya hay cuenta: el último paso es guardar.
      ...(rehacer ? [] : (["cuenta"] as Paso[])),
    ],
    [b.meta, b.condicion, semanas, rehacer],
  );
  const indice = pasos.indexOf(paso);

  const irA = (destino: Paso, sentido: "adelante" | "atras" = "adelante") => {
    setDireccion(sentido);
    setPaso(destino);
  };
  const avanzar = () => irA(pasos[Math.min(indice + 1, pasos.length - 1)]);
  const esUltimo = rehacer && indice === pasos.length - 1;

  /** Rehacer el plan: guardar directo y volver a Hoy. */
  async function guardarRehecho() {
    if (!entrada) return;
    setGuardandoPlan(true);
    setErrorPlan(null);
    try {
      const resultado = await rehacerPlan(entrada);
      if (!resultado.ok) {
        setErrorPlan(resultado.error);
        setGuardandoPlan(false);
        return;
      }
      router.push("/hoy");
    } catch {
      setErrorPlan("No se pudo guardar. Intenta de nuevo.");
      setGuardandoPlan(false);
    }
  }
  const volver = () => irA(pasos[Math.max(indice - 1, 0)], "atras");

  /** Marca la elección y avanza un instante después, para que se vea el pop. */
  const elegir = (parte: Partial<Borrador>, destino?: Paso) => {
    cambiar(parte);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => (destino ? irA(destino) : avanzar()), 280);
  };

  // El paso del borrador puede dejar de existir (cambió la meta, por ejemplo).
  const sinPasoValido = indice === -1;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- corrige el paso cuando cambian los pasos válidos
    if (sinPasoValido) setPaso("meta");
  }, [sinPasoValido]);

  // "Creando" es una espera con sentido: hay un plan que mostrar al terminar.
  useEffect(() => {
    if (paso !== "creando") return;
    const t = setTimeout(() => {
      setDireccion("adelante");
      setPaso("plan");
    }, 2900);
    return () => clearTimeout(t);
  }, [paso]);

  const preguntasVisibles = pasos.filter((p) => PREGUNTAS.includes(p));
  const indicePregunta = preguntasVisibles.indexOf(paso);
  const mostrarBarra = indicePregunta !== -1;
  const sinAtras = indice <= 0 || paso === "creando";

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-md flex-col overflow-x-hidden px-5 pb-8">
      <header className="flex items-center gap-3 pt-5">
        {sinAtras ? (
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={volver}
            aria-label="Volver"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink"
          >
            ←
          </button>
        )}

        {mostrarBarra && (
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline-soft"
            role="img"
            aria-label={`Pregunta ${indicePregunta + 1} de ${preguntasVisibles.length}`}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${((indicePregunta + 1) / preguntasVisibles.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* La clave hace que cada paso sea un elemento nuevo: así entra con su
          animación, deslizándose desde el lado al que se va. */}
      <div
        key={paso}
        className={`flex flex-1 flex-col pt-8 ${direccion === "adelante" ? "paso-adelante" : "paso-atras"}`}
      >
        {paso === "meta" && (
          <Pregunta titulo="¿Cuál es tu objetivo?" ayuda="Con esto calculamos cuántas calorías necesitas.">
            {METAS_ENTRADA.map((m, i) => (
              <Opcion
                key={m.id}
                i={i}
                emoji={m.emoji}
                titulo={m.titulo}
                detalle={m.detalle}
                elegida={b.meta === m.id}
                onElegir={() =>
                  elegir(
                    {
                      meta: m.id,
                      ritmo: preguntaRitmo(m.id) ? b.ritmo : null,
                      pesoMeta: null,
                    },
                    "actividad",
                  )
                }
              />
            ))}
            <p className="entra pt-2 text-center text-sm text-muted" style={{ "--i": 5 } as React.CSSProperties}>
              {rehacer ? (
                <Link href="/perfil" className="text-accent underline underline-offset-4">
                  Cancelar y conservar mi plan actual
                </Link>
              ) : (
                <>
                  ¿Ya tienes cuenta?{" "}
                  <Link href="/login" className="text-accent underline underline-offset-4">
                    Entrar
                  </Link>
                </>
              )}
            </p>
          </Pregunta>
        )}

        {paso === "actividad" && (
          <Pregunta
            titulo="¿Cuánto te mueves en una semana?"
            ayuda="Ante la duda, elige el de abajo: sobrestimarlo infla tu objetivo."
          >
            {ORDEN_ACTIVIDADES.map((id, i) => (
              <Opcion
                key={id}
                i={i}
                emoji={EMOJI_ACTIVIDAD[id]}
                titulo={ACTIVIDADES[id].titulo}
                detalle={ACTIVIDADES[id].detalle}
                elegida={b.actividad === id}
                onElegir={() => elegir({ actividad: id })}
              />
            ))}
          </Pregunta>
        )}

        {paso === "ritmo" && (
          <Pregunta titulo="¿A qué ritmo quieres avanzar?" ayuda="El del medio es el que casi todos sostienen.">
            {ORDEN_RITMOS.map((id, i) => (
              <Opcion
                key={id}
                i={i}
                emoji={EMOJI_RITMO[id]}
                titulo={RITMOS[id].titulo}
                detalle={RITMOS[id].detalle}
                elegida={b.ritmo === id}
                onElegir={() => elegir({ ritmo: id })}
              />
            ))}
          </Pregunta>
        )}

        {paso === "sexo" && (
          <Pregunta titulo="¿Cuál es tu sexo?" ayuda="Lo usamos para calcular cuánta energía gastas en reposo.">
            {(["hombre", "mujer"] as const).map((s, i) => (
              <Opcion
                key={s}
                i={i}
                emoji={s === "hombre" ? "🙋‍♂️" : "🙋‍♀️"}
                titulo={s === "hombre" ? "Hombre" : "Mujer"}
                elegida={b.sexo === s}
                onElegir={() =>
                  elegir(
                    // Valores de partida cercanos a lo típico, para que el
                    // deslizador arranque cerca de la respuesta.
                    b.sexo === null ? { sexo: s, estatura: s === "hombre" ? 172 : 160, peso: s === "hombre" ? 78 : 64 } : { sexo: s },
                  )
                }
              />
            ))}
          </Pregunta>
        )}

        {paso === "edad" && (
          <Pregunta titulo="¿Cuántos años tienes?" ayuda={`La app es para mayores de ${EDAD_MINIMA} años.`}>
            <div className="entra pt-6">
              <SelectorNumero etiqueta="edad" unidad="años" valor={b.edad} min={EDAD_MINIMA} max={90} onCambiar={(v) => cambiar({ edad: v })} />
            </div>
            <Continuar onClick={avanzar} />
          </Pregunta>
        )}

        {paso === "estatura" && (
          <Pregunta titulo="¿Cuánto mides?">
            <div className="entra pt-6">
              <SelectorNumero etiqueta="altura" unidad="cm" valor={b.estatura} min={130} max={220} onCambiar={(v) => cambiar({ estatura: v })} />
            </div>
            <Continuar onClick={avanzar} />
          </Pregunta>
        )}

        {paso === "peso" && (
          <Pregunta titulo="¿Cuánto pesas hoy?" ayuda="Un número aproximado sirve; lo afinas después.">
            <div className="entra pt-6">
              <SelectorNumero
                etiqueta="peso"
                unidad="kg"
                valor={b.peso}
                min={40}
                max={200}
                paso={0.5}
                decimales={1}
                onCambiar={(v) => cambiar({ peso: v })}
              />
            </div>
            <Continuar onClick={avanzar} />
          </Pregunta>
        )}

        {paso === "pesoMeta" && b.meta && (
          <PesoMeta
            meta={b.meta}
            peso={b.peso}
            valor={b.pesoMeta}
            onCambiar={(v) => cambiar({ pesoMeta: v })}
            onContinuar={avanzar}
            onOmitir={() => {
              cambiar({ pesoMeta: null });
              avanzar();
            }}
          />
        )}

        {paso === "reloj" && (
          <Pregunta
            titulo="¿Tu reloj mide cuántas calorías gastas?"
            ayuda="Si lo sabes, calculamos tu plan con tu gasto real y no con una estimación, que puede fallar un 10 %."
          >
            <Opcion
              i={0}
              emoji="⌚"
              titulo="Sí, tengo mi promedio"
              detalle="Garmin, Apple Watch, Fitbit, Polar…"
              elegida={b.reloj === true}
              onElegir={() => cambiar({ reloj: true, gasto: b.gasto ?? gastoFormula })}
            />
            <Opcion
              i={1}
              emoji="🤷"
              titulo="No tengo reloj o no lo sé"
              detalle="Usamos la estimación por fórmula."
              elegida={b.reloj === false}
              onElegir={() => elegir({ reloj: false, gasto: null })}
            />

            {b.reloj && (
              <div className="entra space-y-4 pt-5">
                <SelectorNumero
                  etiqueta="gasto diario"
                  unidad="kcal"
                  valor={b.gasto ?? gastoFormula}
                  min={1400}
                  max={4500}
                  paso={10}
                  onCambiar={(v) => cambiar({ gasto: v })}
                />
                <p className="text-center text-xs text-muted">
                  En Garmin Connect: Calorías quemadas → 4 sem → «Media total». En otro reloj, suma las calorías en
                  reposo y las activas de un día normal.
                </p>
                <Continuar onClick={avanzar} />
              </div>
            )}
          </Pregunta>
        )}

        {paso === "salud" && (
          <Pregunta
            titulo="¿Tienes alguna condición de salud?"
            ayuda="Embarazo o lactancia, diabetes, enfermedad renal o cardiaca, o antecedentes de trastornos de la conducta alimentaria."
          >
            <Opcion i={0} emoji="⚕️" titulo="Sí" elegida={b.condicion === true} onElegir={() => elegir({ condicion: true }, "fuerza")} />
            <Opcion i={1} emoji="✅" titulo="No" elegida={b.condicion === false} onElegir={() => elegir({ condicion: false }, "dieta")} />
            <p className="entra text-center text-xs text-muted" style={{ "--i": 3 } as React.CSSProperties}>
              Tu respuesta no sale de este teléfono: solo la usamos para mostrarte un aviso.
            </p>
          </Pregunta>
        )}

        {paso === "dieta" && (
          <Pregunta titulo="¿Qué tipo de dieta prefieres?" ayuda="Cambia de dónde vienen tus calorías, no cuántas son.">
            {ORDEN_DIETAS.map((id, i) => (
              <Opcion
                key={id}
                i={i}
                emoji={DIETAS[id].emoji}
                titulo={DIETAS[id].titulo}
                detalle={DIETAS[id].detalle}
                elegida={b.dieta === id}
                onElegir={() => elegir({ dieta: id }, "fuerza")}
              />
            ))}
          </Pregunta>
        )}

        {paso === "fuerza" && (
          <Pregunta
            titulo="¿Cuántas veces a la semana haces ejercicio de fuerza?"
            ayuda="Pesas, bandas o tu propio peso. Cambia cuánta proteína necesitas, no cuántas calorías."
          >
            {ORDEN_FUERZA.map((id, i) => (
              <Opcion
                key={id}
                i={i}
                emoji={EMOJI_FUERZA[id]}
                titulo={NOMBRE_FUERZA[id]}
                elegida={b.fuerza === id}
                onElegir={() => elegir({ fuerza: id }, "creando")}
              />
            ))}
            <p className="entra text-center text-xs text-muted" style={{ "--i": 5 } as React.CSSProperties}>
              Con menos fuerza, el cuerpo protege menos músculo y la proteína que necesitas es un poco menor.
            </p>
          </Pregunta>
        )}

        {paso === "creando" && <Creando />}

        {paso === "plan" && plan && entrada && b.meta && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="relative mx-auto flex h-16 w-16 items-center justify-center text-5xl" aria-hidden="true">
                <span className="pop">✅</span>
                <Confeti />
              </p>
              <h1 className="entra mt-3 font-serif text-2xl text-ink" style={{ "--i": 1 } as React.CSSProperties}>
                Estas son las calorías que necesitas al día
              </h1>
            </div>

            <div className="entra rounded-3xl border border-hairline bg-surface p-5 shadow-[var(--shadow)]" style={{ "--i": 2 } as React.CSSProperties}>
              <MedidorSemicirculo valor={plan.calculo.kcalObjetivo} unidad="kcal" min={plan.rango.min} max={plan.rango.max} />
              {entrada.dieta && entrada.dieta !== "recomendada" && (
                <p className="mt-4 text-center text-sm text-ink-2">
                  <span aria-hidden="true">{DIETAS[entrada.dieta].emoji}</span> Dieta {DIETAS[entrada.dieta].titulo.toLowerCase()}
                </p>
              )}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Macro i={0} etiqueta="Proteínas" g={plan.calculo.proteinaG} color="var(--macro-prot)" />
                <Macro i={1} etiqueta="Carbos" g={plan.calculo.carbsG} color="var(--macro-carb)" />
                <Macro i={2} etiqueta="Grasas" g={plan.calculo.grasaG} color="var(--macro-gras)" />
              </div>
            </div>

            <div className="entra" style={{ "--i": 4 } as React.CSSProperties}>
              <Aviso nivel="info">{EXPECTATIVA[b.meta]}</Aviso>
            </div>

            {entrada.dieta && DIETAS[entrada.dieta].aviso && (
              <Aviso nivel="atencion">{DIETAS[entrada.dieta].aviso}</Aviso>
            )}
            {b.condicion && (
              <Aviso nivel="atencion">
                Por tu condición de salud, habla con tu médico o un nutricionista antes de cambiar tu alimentación. Usa este plan
                solo como referencia.
              </Aviso>
            )}
            {plan.calculo.avisos.map((aviso, i) => (
              <Aviso key={i} nivel={aviso.nivel}>
                {aviso.mensaje}
              </Aviso>
            ))}

            {esUltimo && errorPlan && <Aviso nivel="error">{errorPlan}</Aviso>}
            <Principal onClick={esUltimo ? guardarRehecho : avanzar} deshabilitado={guardandoPlan}>
              {esUltimo ? (guardandoPlan ? "Guardando…" : "Guardar mi plan") : "Continuar"}
            </Principal>
            <p className="text-center text-xs text-muted">
              Es un cálculo, no una verdad: un punto de partida que la app ajusta con lo que muestre tu peso. No reemplaza la
              consulta con un profesional de la salud.
            </p>
          </div>
        )}

        {paso === "proyeccion" && entrada && entrada.pesoMetaKg !== undefined && semanas !== null && (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="entra font-serif text-2xl text-ink">
                {entrada.pesoMetaKg < entrada.pesoKg ? "Así sería tu camino" : "Así sería tu progreso"}
              </h1>
              <p className="entra mt-2 text-sm text-muted" style={{ "--i": 1 } as React.CSSProperties}>
                A este ritmo, unas <span className="font-medium text-ink">{semanas} semanas</span> hasta tu peso objetivo.
              </p>
            </div>
            <div className="entra rounded-3xl border border-hairline bg-surface p-5 shadow-[var(--shadow)]" style={{ "--i": 2 } as React.CSSProperties}>
              <ProyeccionPeso pesoKg={entrada.pesoKg} metaKg={entrada.pesoMetaKg} semanas={semanas} />
            </div>
            <p className="entra text-center text-xs text-muted" style={{ "--i": 3 } as React.CSSProperties}>
              Es una estimación: tu cuerpo puede ir más rápido o más lento, y la app ajusta el plan con lo que muestre tu peso.
            </p>
            {esUltimo && errorPlan && <Aviso nivel="error">{errorPlan}</Aviso>}
            <Principal onClick={esUltimo ? guardarRehecho : avanzar} deshabilitado={guardandoPlan}>
              {guardandoPlan ? "Guardando…" : "Guardar mi plan"}
            </Principal>
          </div>
        )}

        {paso === "cuenta" && entrada && <Cuenta entrada={entrada} />}

        {(paso === "plan" || paso === "proyeccion" || paso === "cuenta") && !entrada && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-ink-2">Faltan datos para armar tu plan. Revisa tus respuestas.</p>
            <Principal onClick={() => irA("meta", "atras")}>Volver al inicio</Principal>
          </div>
        )}
      </div>
    </main>
  );
}

// ------------------------------------------------------------- peso meta ---

function PesoMeta({
  meta,
  peso,
  valor,
  onCambiar,
  onContinuar,
  onOmitir,
}: {
  meta: Meta;
  peso: number;
  valor: number | null;
  onCambiar: (v: number) => void;
  onContinuar: () => void;
  onOmitir: () => void;
}) {
  const sube = meta === "ganar_musculo";
  const min = sube ? peso + 1 : Math.max(40, Math.round(peso * 0.6));
  const max = sube ? Math.min(200, Math.round(peso * 1.3)) : peso - 1;
  const sugerido = Math.min(max, Math.max(min, metaSugerida(meta, peso)));
  const actual = valor !== null && pesoMetaCoherente(meta, peso, valor) ? valor : sugerido;
  const diferencia = Math.abs(actual - peso);

  return (
    <Pregunta titulo="¿Cuál es tu peso objetivo?" ayuda={`Hoy pesas ${String(peso).replace(".", ",")} kg.`}>
      <div className="entra pt-4">
        <SelectorNumero etiqueta="peso objetivo" unidad="kg" valor={actual} min={min} max={max} onCambiar={onCambiar} />
      </div>
      <p className="entra pt-2 text-center text-sm text-ink-2" style={{ "--i": 1 } as React.CSSProperties}>
        {sube ? "Subirías" : "Bajarías"} <span className="font-medium">{String(diferencia).replace(".", ",")} kg</span>
      </p>
      <Principal
        onClick={() => {
          onCambiar(actual);
          onContinuar();
        }}
      >
        Continuar
      </Principal>
      <Secundario onClick={onOmitir}>Prefiero no ponerlo</Secundario>
    </Pregunta>
  );
}

// ---------------------------------------------------------------- cuenta ---

function Cuenta({ entrada }: { entrada: EntradaDatos }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<
    { tipo: "inicial" } | { tipo: "enviando" } | { tipo: "enviado"; email: string } | { tipo: "error"; mensaje: string }
  >({ tipo: "inicial" });

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado({ tipo: "enviando" });
    try {
      const { error } = await clienteNavegador().auth.signInWithOtp({
        email,
        options: {
          // Las respuestas viajan con la cuenta nueva y se aplican al canjear
          // el enlace. Para una cuenta que ya existe, Supabase las ignora.
          data: { entrada },
          emailRedirectTo: `${window.location.origin}/auth/callback?siguiente=/hoy`,
        },
      });
      if (error) throw error;
      try {
        localStorage.removeItem(CLAVE_BORRADOR);
      } catch {
        // No pasa nada si no se puede limpiar.
      }
      setEstado({ tipo: "enviado", email });
    } catch (err) {
      setEstado({
        tipo: "error",
        mensaje: err instanceof Error ? err.message : "No se pudo enviar el enlace. Intenta de nuevo.",
      });
    }
  }

  if (estado.tipo === "enviado") {
    return (
      <div className="space-y-4 text-center">
        <p className="pop text-5xl" aria-hidden="true">
          📬
        </p>
        <h1 className="entra font-serif text-2xl text-ink">Revisa tu correo</h1>
        <p className="entra text-sm text-ink-2" style={{ "--i": 1 } as React.CSSProperties}>
          Te enviamos un enlace a <span className="font-medium">{estado.email}</span>. Ábrelo desde este mismo teléfono para
          entrar y ver tu plan. Vence en una hora.
        </p>
        <Secundario onClick={() => setEstado({ tipo: "inicial" })}>Usar otro correo</Secundario>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="text-center">
        <h1 className="entra font-serif text-2xl text-ink">¡Casi listo! Crea tu cuenta para guardar tu plan</h1>
        <p className="entra mt-2 text-sm text-muted" style={{ "--i": 1 } as React.CSSProperties}>
          Sin contraseña: te enviamos un enlace que te deja adentro.
        </p>
      </div>

      <label htmlFor="email" className="entra block text-sm font-medium text-ink-2" style={{ "--i": 2 } as React.CSSProperties}>
        Tu correo
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        className="entra w-full rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-base text-ink outline-none placeholder:text-muted focus:border-accent"
        style={{ "--i": 3 } as React.CSSProperties}
      />

      <Principal tipo="submit" deshabilitado={estado.tipo === "enviando" || email.length === 0}>
        {estado.tipo === "enviando" ? "Enviando…" : "Enviarme el enlace"}
      </Principal>

      {estado.tipo === "error" && (
        <p role="alert" className="text-sm text-bad">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}

// ----------------------------------------------------------------- piezas ---

function Creando() {
  const lineas = ["Analizando tu meta", "Calculando tus calorías", "Ajustando tus macros"];
  const [hechas, setHechas] = useState(0);
  const porcentaje = useCuenta(100, 2600);

  useEffect(() => {
    const ts = lineas.map((_, i) => setTimeout(() => setHechas(i + 1), 800 * (i + 1) - 200));
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las líneas son constantes
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center" aria-live="polite">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent)" strokeOpacity="0.15" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            style={{ animation: "anillo 2600ms cubic-bezier(0.4, 0, 0.2, 1) backwards" }}
          />
        </svg>
        <div className="respira flex flex-col items-center">
          <span className="text-5xl" aria-hidden="true">
            🥗
          </span>
          <span className="mt-1 font-mono text-sm text-muted tabular-nums">{Math.round(porcentaje)}%</span>
        </div>
      </div>
      <h1 className="font-serif text-2xl text-ink">Creando el mejor plan para ti…</h1>
      <ul className="space-y-3 text-left">
        {lineas.map((l, i) => (
          <li key={l} className="flex items-center gap-3 text-ink-2">
            <span
              key={i < hechas ? "ok" : "espera"}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors ${
                i < hechas ? "pop bg-accent text-sobre-accent" : "border border-hairline text-transparent"
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pregunta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="pb-3 text-center">
        <h1 className="font-serif text-2xl text-ink">{titulo}</h1>
        {ayuda && <p className="mt-2 text-sm text-muted">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

function Opcion({
  i,
  emoji,
  titulo,
  detalle,
  elegida,
  onElegir,
}: {
  i: number;
  emoji?: string;
  titulo: string;
  detalle?: string;
  elegida: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={elegida}
      className={`entra flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
        elegida ? "border-accent bg-accent-soft" : "border-transparent bg-hairline-soft"
      }`}
      style={{ "--i": i + 1 } as React.CSSProperties}
    >
      {emoji && (
        <span className={`text-2xl ${elegida ? "pop" : ""}`} aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-ink">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-sm text-muted">{detalle}</span>}
      </span>
      <span
        key={elegida ? "si" : "no"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
          elegida ? "pop border-accent bg-accent text-sobre-accent" : "border-hairline text-transparent"
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
    </button>
  );
}

function Macro({ i, etiqueta, g, color }: { i: number; etiqueta: string; g: number; color: string }) {
  const animado = useCuenta(g, 900);
  return (
    <div>
      <p className="text-sm text-muted">{etiqueta}</p>
      <p className="font-mono text-base font-semibold text-ink tabular-nums">{Math.round(animado)} g</p>
      <div
        className="crece-x mx-auto mt-1.5 h-1.5 w-12 rounded-full"
        style={{ background: color, "--i": i } as React.CSSProperties}
        aria-hidden="true"
      />
    </div>
  );
}

function Continuar({ onClick }: { onClick: () => void }) {
  return (
    <div className="pt-8">
      <Principal onClick={onClick}>Continuar</Principal>
    </div>
  );
}

function Principal({
  children,
  onClick,
  deshabilitado,
  tipo = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  deshabilitado?: boolean;
  tipo?: "button" | "submit";
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado}
      className="w-full rounded-full bg-accent px-5 py-4 text-base font-semibold text-sobre-accent transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Secundario({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-full bg-hairline-soft px-5 py-4 text-base font-medium text-ink">
      {children}
    </button>
  );
}
