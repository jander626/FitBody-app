"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso } from "@/components/ui";
import { MedidorSemicirculo } from "@/components/medidor-semicirculo";
import { clienteNavegador } from "@/lib/supabase/cliente-navegador";
import {
  EDAD_MINIMA,
  EntradaSchema,
  pesoMetaCoherente,
  planDeEntrada,
  preguntaPesoMeta,
  preguntaRitmo,
  semanasHastaMeta,
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
 * El flujo de entrada: preguntas, plan y, al final, la cuenta.
 *
 * Va en este orden a propósito. Pedir el correo primero es pedirle a un
 * desconocido que confíe antes de recibir nada; verle su número primero es
 * darle algo que ya es suyo. El correo llega cuando ya hay algo que guardar.
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
  | "datos"
  | "pesoMeta"
  | "salud"
  | "creando"
  | "plan"
  | "cuenta";

const CLAVE_BORRADOR = "fitfood-entrada";

const METAS_ENTRADA: { id: Meta; emoji: string; titulo: string; detalle: string }[] = [
  { id: "bajar_grasa", emoji: "🔥", titulo: "Bajar de peso", detalle: "Perder grasa a un ritmo que se sostenga." },
  { id: "tonificar", emoji: "💪", titulo: "Tonificar", detalle: "Bajar grasa despacio sin perder músculo." },
  { id: "mantener", emoji: "❤️", titulo: "Mantener mi peso", detalle: "Quedarme donde estoy y comer mejor." },
  { id: "ganar_musculo", emoji: "🏋️", titulo: "Ganar músculo", detalle: "Subir de peso entrenando fuerza." },
];

const EXPECTATIVA: Record<Meta, string> = {
  bajar_grasa:
    "Comerás un poco menos de lo que gastas. Con proteína alta y algo de entrenamiento, lo que baja es sobre todo grasa.",
  tonificar:
    "Es bajar de peso despacio y con la proteína más alta. La balanza casi no se mueve; lo que cambia es cómo te queda la ropa, y toma meses.",
  mantener:
    "Comerás lo que gastas. El registro sirve para ver qué comes, no para cambiarlo.",
  ganar_musculo:
    "Comerás un poco más de lo que gastas. Parte de lo que subas será grasa: no hay forma de evitarlo del todo.",
};

interface Borrador {
  meta: Meta | null;
  actividad: NivelActividad | null;
  ritmo: Ritmo | null;
  sexo: "hombre" | "mujer" | null;
  edad: string;
  estatura: string;
  peso: string;
  pesoMeta: string;
  condicion: boolean | null;
}

const VACIO: Borrador = {
  meta: null,
  actividad: null,
  ritmo: null,
  sexo: null,
  edad: "",
  estatura: "",
  peso: "",
  pesoMeta: "",
  condicion: null,
};

function leerBorrador(): Borrador {
  try {
    const crudo = localStorage.getItem(CLAVE_BORRADOR);
    return crudo ? { ...VACIO, ...JSON.parse(crudo) } : VACIO;
  } catch {
    return VACIO;
  }
}

const numero = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function Entrada() {
  const [b, setB] = useState<Borrador>(VACIO);
  const [paso, setPaso] = useState<Paso>("meta");
  const [listo, setListo] = useState(false);

  // El borrador se lee después de montar: leerlo durante el render daría un
  // HTML distinto en servidor y cliente.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, que solo existe en el cliente
    setB(leerBorrador());
    setListo(true);
  }, []);

  useEffect(() => {
    if (!listo) return;
    try {
      // La condición de salud no se guarda ni en el borrador: solo vive en la
      // pantalla mientras se usa para mostrar el aviso.
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ ...b, condicion: null }));
    } catch {
      // Sin almacenamiento (ventana privada) el flujo sigue funcionando.
    }
  }, [b, listo]);

  const cambiar = (parte: Partial<Borrador>) => setB((previo) => ({ ...previo, ...parte }));

  const pasos: Paso[] = useMemo(
    () => [
      "meta",
      "actividad",
      ...(b.meta && preguntaRitmo(b.meta) ? (["ritmo"] as Paso[]) : []),
      "datos",
      ...(b.meta && preguntaPesoMeta(b.meta) ? (["pesoMeta"] as Paso[]) : []),
      "salud",
      "creando",
      "plan",
      "cuenta",
    ],
    [b.meta],
  );
  const indice = pasos.indexOf(paso);
  const avanzar = () => setPaso(pasos[Math.min(indice + 1, pasos.length - 1)]);
  const volver = () => setPaso(pasos[Math.max(indice - 1, 0)]);

  const edad = numero(b.edad);
  const estatura = numero(b.estatura);
  const peso = numero(b.peso);
  const pesoMeta = numero(b.pesoMeta);

  const entrada: EntradaDatos | null = useMemo(() => {
    if (!b.meta || !b.actividad || !b.sexo) return null;
    const analisis = EntradaSchema.safeParse({
      meta: b.meta,
      actividad: b.actividad,
      ...(b.ritmo && preguntaRitmo(b.meta) ? { ritmo: b.ritmo } : {}),
      sexo: b.sexo,
      edad,
      estaturaCm: estatura,
      pesoKg: peso,
      ...(pesoMeta !== null && preguntaPesoMeta(b.meta) ? { pesoMetaKg: pesoMeta } : {}),
    });
    return analisis.success ? analisis.data : null;
  }, [b, edad, estatura, peso, pesoMeta]);

  const plan = useMemo(() => (entrada ? planDeEntrada(entrada) : null), [entrada]);

  // Pasar por "creando" solo tiene sentido con un plan que mostrar.
  useEffect(() => {
    if (paso !== "creando") return;
    const t = setTimeout(() => setPaso("plan"), 2600);
    return () => clearTimeout(t);
  }, [paso]);

  const menor = edad !== null && edad < EDAD_MINIMA;
  const personaValida = EntradaSchema.pick({
    sexo: true,
    edad: true,
    estaturaCm: true,
    pesoKg: true,
  }).safeParse({ sexo: b.sexo, edad, estaturaCm: estatura, pesoKg: peso }).success;
  const datosCompletos = personaValida;
  const hayDatosFueraDeRango =
    !menor &&
    !personaValida &&
    b.sexo !== null &&
    edad !== null &&
    estatura !== null &&
    peso !== null;

  // El borrador puede traer un paso que ya no corresponde (cambió la meta).
  const sinPasoValido = !pasos.includes(paso);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- corrige el paso cuando cambian los pasos válidos
    if (sinPasoValido) setPaso("meta");
  }, [sinPasoValido]);

  const mostrarBarra = paso !== "creando" && paso !== "plan" && paso !== "cuenta";
  const visibles = pasos.filter((p) => p !== "creando" && p !== "plan" && p !== "cuenta");

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8">
      <header className="flex items-center gap-3 pt-5">
        {indice > 0 && paso !== "creando" ? (
          <button
            type="button"
            onClick={volver}
            aria-label="Volver"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink"
          >
            ←
          </button>
        ) : (
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        )}

        {mostrarBarra && (
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-hairline-soft"
            role="img"
            aria-label={`Paso ${Math.min(indice + 1, visibles.length)} de ${visibles.length}`}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${((indice + 1) / visibles.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col pt-8">
        {paso === "meta" && (
          <Pregunta titulo="¿Cuál es tu objetivo?" ayuda="Con esto calculamos cuántas calorías necesitas.">
            {METAS_ENTRADA.map((m) => (
              <Opcion
                key={m.id}
                emoji={m.emoji}
                titulo={m.titulo}
                detalle={m.detalle}
                elegida={b.meta === m.id}
                onElegir={() => {
                  cambiar({ meta: m.id, ritmo: preguntaRitmo(m.id) ? b.ritmo : null });
                  setPaso("actividad");
                }}
              />
            ))}
            <p className="pt-2 text-center text-sm text-muted">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-accent underline underline-offset-4">
                Entrar
              </Link>
            </p>
          </Pregunta>
        )}

        {paso === "actividad" && (
          <Pregunta
            titulo="¿Cuánto te mueves en una semana?"
            ayuda="Ante la duda, elige el de abajo: sobrestimarlo infla tu objetivo."
          >
            {ORDEN_ACTIVIDADES.map((id) => (
              <Opcion
                key={id}
                titulo={ACTIVIDADES[id].titulo}
                detalle={ACTIVIDADES[id].detalle}
                elegida={b.actividad === id}
                onElegir={() => {
                  cambiar({ actividad: id });
                  avanzar();
                }}
              />
            ))}
          </Pregunta>
        )}

        {paso === "ritmo" && (
          <Pregunta titulo="¿A qué ritmo quieres avanzar?">
            {ORDEN_RITMOS.map((id) => (
              <Opcion
                key={id}
                titulo={RITMOS[id].titulo}
                detalle={RITMOS[id].detalle}
                elegida={b.ritmo === id}
                onElegir={() => {
                  cambiar({ ritmo: id });
                  avanzar();
                }}
              />
            ))}
          </Pregunta>
        )}

        {paso === "datos" && (
          <Pregunta titulo="Sobre ti" ayuda="Esta información nos ayuda a calcular tus calorías objetivo.">
            <div className="grid grid-cols-2 gap-3">
              {(["hombre", "mujer"] as const).map((s) => (
                <Opcion
                  key={s}
                  titulo={s === "hombre" ? "Hombre" : "Mujer"}
                  elegida={b.sexo === s}
                  onElegir={() => cambiar({ sexo: s })}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CampoNumero etiqueta="Edad" unidad="años" valor={b.edad} onCambiar={(v) => cambiar({ edad: v })} modo="numeric" />
              <CampoNumero etiqueta="Altura" unidad="cm" valor={b.estatura} onCambiar={(v) => cambiar({ estatura: v })} modo="numeric" />
              <CampoNumero etiqueta="Peso" unidad="kg" valor={b.peso} onCambiar={(v) => cambiar({ peso: v })} modo="decimal" />
            </div>
            {menor && (
              <Aviso nivel="atencion">
                Esta app es para mayores de {EDAD_MINIMA} años. Si quieres cuidar tu alimentación,
                hazlo con un pediatra o un nutricionista.
              </Aviso>
            )}
            {hayDatosFueraDeRango && (
              <Aviso nivel="atencion">
                Revisa los valores: la edad, la altura (100 a 250 cm) o el peso (20 a 400 kg) no parecen
                correctos.
              </Aviso>
            )}
            <Principal deshabilitado={!datosCompletos} onClick={avanzar}>
              Continuar
            </Principal>
          </Pregunta>
        )}

        {paso === "pesoMeta" && b.meta && peso !== null && (
          <Pregunta titulo="¿Cuál es tu peso objetivo?" ayuda={`Hoy pesas ${peso} kg.`}>
            <CampoNumero
              etiqueta="Peso objetivo"
              unidad="kg"
              valor={b.pesoMeta}
              onCambiar={(v) => cambiar({ pesoMeta: v })}
              modo="decimal"
            />
            {pesoMeta !== null && !pesoMetaCoherente(b.meta, peso, pesoMeta) && (
              <Aviso nivel="atencion">
                {b.meta === "ganar_musculo"
                  ? "Para ganar músculo, tu peso objetivo debe ser mayor al de hoy."
                  : "Para bajar, tu peso objetivo debe ser menor al de hoy."}
              </Aviso>
            )}
            <Principal
              deshabilitado={pesoMeta === null || !pesoMetaCoherente(b.meta, peso, pesoMeta)}
              onClick={avanzar}
            >
              Continuar
            </Principal>
            <Secundario
              onClick={() => {
                cambiar({ pesoMeta: "" });
                avanzar();
              }}
            >
              Prefiero no ponerlo
            </Secundario>
          </Pregunta>
        )}

        {paso === "salud" && (
          <Pregunta
            titulo="¿Tienes alguna condición de salud?"
            ayuda="Embarazo o lactancia, diabetes, enfermedad renal o cardiaca, o antecedentes de trastornos de la conducta alimentaria."
          >
            <Opcion
              titulo="Sí"
              elegida={b.condicion === true}
              onElegir={() => {
                cambiar({ condicion: true });
                setPaso("creando");
              }}
            />
            <Opcion
              titulo="No"
              elegida={b.condicion === false}
              onElegir={() => {
                cambiar({ condicion: false });
                setPaso("creando");
              }}
            />
            <p className="text-center text-xs text-muted">
              Tu respuesta no sale de este teléfono: solo la usamos para mostrarte un aviso.
            </p>
          </Pregunta>
        )}

        {paso === "creando" && <Creando />}

        {paso === "plan" && plan && entrada && b.meta && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-4xl" aria-hidden="true">
                ✅
              </p>
              <h1 className="mt-3 font-serif text-2xl text-ink">
                Estas son las calorías que necesitas al día
              </h1>
            </div>

            <Tarjeta>
              <MedidorSemicirculo
                valor={plan.calculo.kcalObjetivo}
                unidad="kcal"
                min={plan.rango.min}
                max={plan.rango.max}
              />
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <Macro etiqueta="Proteínas" g={plan.calculo.proteinaG} color="var(--macro-prot)" />
                <Macro etiqueta="Carbos" g={plan.calculo.carbsG} color="var(--macro-carb)" />
                <Macro etiqueta="Grasas" g={plan.calculo.grasaG} color="var(--macro-gras)" />
              </div>
            </Tarjeta>

            {entrada.pesoMetaKg !== undefined &&
              (() => {
                const semanas = semanasHastaMeta(
                  entrada.pesoKg,
                  entrada.pesoMetaKg,
                  plan.calculo.ritmoEsperadoKgSemana,
                );
                return (
                  <Tarjeta>
                    <p className="text-sm text-muted">Tu objetivo</p>
                    <p className="mt-1 font-mono text-lg text-ink tabular-nums">
                      {entrada.pesoKg} kg → {entrada.pesoMetaKg} kg
                    </p>
                    <p className="mt-2 text-sm text-ink-2">
                      {semanas !== null
                        ? `A este ritmo, unas ${semanas} semanas. Es una estimación: tu cuerpo puede ir más rápido o más lento.`
                        : "Con este plan no se puede estimar cuánto tardarías. Ajustaremos el plan con lo que muestre tu peso."}
                    </p>
                  </Tarjeta>
                );
              })()}

            <Aviso nivel="info">{EXPECTATIVA[b.meta]}</Aviso>

            {b.condicion && (
              <Aviso nivel="atencion">
                Por tu condición de salud, habla con tu médico o un nutricionista antes de cambiar tu
                alimentación. Usa este plan solo como referencia.
              </Aviso>
            )}
            {plan.calculo.avisos.map((aviso, i) => (
              <Aviso key={i} nivel={aviso.nivel}>
                {aviso.mensaje}
              </Aviso>
            ))}

            <Principal onClick={avanzar}>Guardar mi plan</Principal>
            <p className="text-center text-xs text-muted">
              Es un cálculo, no una verdad: un punto de partida que la app ajusta con lo que muestre tu
              peso. No reemplaza la consulta con un profesional de la salud.
            </p>
          </div>
        )}

        {paso === "cuenta" && entrada && <Cuenta entrada={entrada} />}

        {(paso === "plan" || paso === "cuenta") && !entrada && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-ink-2">Faltan datos para armar tu plan. Revisa tus respuestas.</p>
            <Principal onClick={() => setPaso("meta")}>Volver al inicio</Principal>
          </div>
        )}
      </div>
    </main>
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
        <p className="text-5xl" aria-hidden="true">
          📬
        </p>
        <h1 className="font-serif text-2xl text-ink">Revisa tu correo</h1>
        <p className="text-sm text-ink-2">
          Te enviamos un enlace a <span className="font-medium">{estado.email}</span>. Ábrelo desde este
          mismo teléfono para entrar y ver tu plan. Vence en una hora.
        </p>
        <Secundario onClick={() => setEstado({ tipo: "inicial" })}>Usar otro correo</Secundario>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="text-center">
        <h1 className="font-serif text-2xl text-ink">¡Casi listo! Crea tu cuenta para guardar tu plan</h1>
        <p className="mt-2 text-sm text-muted">Sin contraseña: te enviamos un enlace que te deja adentro.</p>
      </div>

      <label htmlFor="email" className="block text-sm font-medium text-ink-2">
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
        className="w-full rounded-2xl border border-hairline bg-surface px-4 py-3.5 text-base text-ink outline-none placeholder:text-muted focus:border-accent"
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

  useEffect(() => {
    const ts = lineas.map((_, i) => setTimeout(() => setHechas(i + 1), 700 * (i + 1)));
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las líneas son constantes
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center" aria-live="polite">
      <div className="flex h-40 w-40 items-center justify-center rounded-full bg-accent-soft">
        <div className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full bg-accent-soft text-5xl">
          🥗
        </div>
      </div>
      <h1 className="font-serif text-2xl text-ink">Creando el mejor plan para ti…</h1>
      <ul className="space-y-3 text-left">
        {lineas.map((l, i) => (
          <li key={l} className="flex items-center gap-3 text-ink-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                i < hechas ? "bg-accent text-sobre-accent" : "border border-hairline text-transparent"
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
  emoji,
  titulo,
  detalle,
  elegida,
  onElegir,
}: {
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
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
        elegida ? "border-accent bg-accent-soft" : "border-transparent bg-hairline-soft"
      }`}
    >
      {emoji && (
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-ink">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-sm text-muted">{detalle}</span>}
      </span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
          elegida ? "border-accent bg-accent text-sobre-accent" : "border-hairline text-transparent"
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
    </button>
  );
}

function CampoNumero({
  etiqueta,
  unidad,
  valor,
  onCambiar,
  modo,
}: {
  etiqueta: string;
  unidad: string;
  valor: string;
  onCambiar: (v: string) => void;
  modo: "numeric" | "decimal";
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-2">{etiqueta}</span>
      <div className="mt-1.5 flex items-baseline gap-1 rounded-2xl border border-hairline bg-surface px-3.5 py-3 focus-within:border-accent">
        <input
          type="text"
          inputMode={modo}
          value={valor}
          onChange={(e) => onCambiar(e.target.value.replace(/[^\d.,]/g, ""))}
          className="w-full min-w-0 bg-transparent text-lg text-ink outline-none"
          aria-label={`${etiqueta} en ${unidad}`}
        />
        <span className="text-xs text-muted">{unidad}</span>
      </div>
    </label>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface p-5 shadow-[var(--shadow)]">
      {children}
    </div>
  );
}

function Macro({ etiqueta, g, color }: { etiqueta: string; g: number; color: string }) {
  return (
    <div>
      <p className="text-sm text-muted">{etiqueta}</p>
      <p className="font-mono text-base font-semibold text-ink tabular-nums">{g} g</p>
      <div className="mx-auto mt-1.5 h-1.5 w-12 rounded-full" style={{ background: color }} aria-hidden="true" />
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
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full bg-hairline-soft px-5 py-4 text-base font-medium text-ink"
    >
      {children}
    </button>
  );
}
