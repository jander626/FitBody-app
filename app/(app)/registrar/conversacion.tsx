"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import { EditorItems, type ItemEditable } from "@/components/editor-items";
import { useHidratado } from "@/components/hidratado";
import type { Alimento } from "@/lib/alimentos";
import { comprimirFoto } from "@/lib/foto";
import { LIMITES } from "@/lib/guardrails/limites";
import {
  MOMENTOS,
  NOMBRE_MOMENTO,
  momentoSugerido,
  totalesDeItems,
  type ItemBorrador,
} from "@/lib/registro/tipos";
import {
  guardarBorrador,
  guardarFoto,
  leerBorrador,
  leerFoto,
  limpiarBorrador,
  type Estimacion,
} from "@/lib/registro/borrador";
import { clienteNavegador } from "@/lib/supabase/cliente-navegador";
import { guardarComida } from "./acciones";

const NOMBRE_CONFIANZA: Record<string, string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
};

/** Lo que sobrevive a que se caiga la pantalla. El resto es de esta sesión. */
interface EstadoBorrador {
  texto: string;
  momento: (typeof MOMENTOS)[number];
  estimacion: Estimacion | null;
  items: ItemEditable[];
}

export function Conversacion(props: {
  alimentos: Alimento[];
  fecha: string;
  userId: string;
}) {
  // El borrador vive en localStorage, que en el servidor no existe. Montar el
  // formulario recién después de hidratar evita que el servidor pinte uno
  // vacío y el cliente uno con lo recuperado: para React eso es HTML que no
  // corresponde, y tiene razón.
  const hidratado = useHidratado();
  if (!hidratado) return <Esqueleto />;
  return <Formulario {...props} />;
}

/** Del alto del formulario vacío, para que no salte al aparecer. */
function Esqueleto() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-[74px] rounded-2xl border border-dashed border-hairline bg-surface" />
      <div className="h-[88px] rounded-xl border border-hairline bg-surface" />
      <div className="h-[50px] rounded-xl bg-surface opacity-50" />
    </div>
  );
}

function Formulario({
  alimentos,
  fecha,
  userId,
}: {
  alimentos: Alimento[];
  fecha: string;
  userId: string;
}) {
  const router = useRouter();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [recuperado] = useState(() => leerBorrador({ fecha }));
  const [estado, setEstado] = useState<EstadoBorrador>(() =>
    recuperado
      ? { ...recuperado, items: recuperado.items.map(conClave) }
      : {
          texto: "",
          momento: momentoSugerido(new Date().getHours()),
          estimacion: null,
          items: [],
        },
  );
  const [foto, setFoto] = useState<{ base64: string } | null>(() => {
    const guardada = leerFoto();
    return guardada ? { base64: guardada } : null;
  });
  const [avisoRecuperado, setAvisoRecuperado] = useState(recuperado !== null);

  const [error, setError] = useState<string | null>(null);
  const [fueraDeTema, setFueraDeTema] = useState<string | null>(null);
  /** La foto se estimó pero no se pudo archivar. Se avisa sin bloquear. */
  const [fotoNoGuardada, setFotoNoGuardada] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [guardando, iniciarGuardado] = useTransition();

  const { texto, momento, estimacion, items } = estado;
  const totales = totalesDeItems(items);
  const sinTurnos = estimacion !== null && estimacion.turnosRestantes <= 0;

  /**
   * Cambia el estado y lo deja escrito, en ese orden y sin efectos.
   *
   * Va acá y no en un `useEffect` porque persistir es la consecuencia de una
   * acción concreta, no de que el render haya terminado. `estado` sale del
   * cierre del render actual, que es el bueno: todas las llamadas vienen de
   * manejadores de eventos.
   */
  function actualizar(cambio: Partial<EstadoBorrador>) {
    const siguiente = { ...estado, ...cambio };
    setEstado(siguiente);
    guardarBorrador({
      fecha,
      texto: siguiente.texto,
      momento: siguiente.momento,
      estimacion: siguiente.estimacion,
      items: siguiente.items.map(aItemBorrador),
    });
  }

  function ponerFoto(base64: string | null) {
    setFoto(base64 ? { base64 } : null);
    guardarFoto(base64);
    if (base64 === null && inputFoto.current) inputFoto.current.value = "";
  }

  async function elegirFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setError(null);
    try {
      const comprimida = await comprimirFoto(archivo);
      ponerFoto(comprimida.base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la foto.");
    }
  }

  /** Sube la foto a Storage para poder medir precisión después. */
  async function subirFoto(base64: string): Promise<string | null> {
    try {
      const supabase = clienteNavegador();
      const ruta = `${userId}/${crypto.randomUUID()}.jpg`;
      const binario = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { error: errSubida } = await supabase.storage
        .from("comidas")
        .upload(ruta, binario, { contentType: "image/jpeg" });
      return errSubida ? null : ruta;
    } catch {
      // Que falle guardar la foto no debe impedir registrar la comida: la
      // foto es telemetría, la comida es el dato.
      return null;
    }
  }

  async function enviar(mensaje: string) {
    setError(null);
    setFueraDeTema(null);
    setAvisoRecuperado(false);
    setPensando(true);

    try {
      const fotoPath =
        foto && !estimacion ? await subirFoto(foto.base64) : null;

      // Que la foto no se archive no impide registrar la comida — el dato son
      // los números. Pero tampoco puede pasar callado: si falla siempre (el
      // bucket no existe, o falta una política), uno se entera meses después
      // al abrir el diario y no encontrar ninguna imagen.
      if (foto && !estimacion) setFotoNoGuardada(fotoPath === null);

      const respuesta = await fetch("/api/registro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: estimacion?.sessionId ?? null,
          texto: mensaje || null,
          // La foto solo viaja en el primer turno: reenviarla en cada vuelta
          // multiplicaría el costo sin agregar nada.
          fotoBase64: estimacion ? null : (foto?.base64 ?? null),
          fotoMediaType: estimacion ? null : foto ? "image/jpeg" : null,
          fotoPath,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        setError(datos.error ?? "No se pudo estimar la comida.");
        return;
      }

      if (datos.fueraDeTema) {
        setFueraDeTema(datos.mensaje);
        if (estimacion) {
          actualizar({
            estimacion: {
              ...estimacion,
              turnosRestantes: datos.turnosRestantes,
            },
          });
        }
        return;
      }

      actualizar({
        estimacion: {
          sessionId: datos.sessionId,
          momento: datos.momento,
          confianza: datos.confianza,
          preguntas: datos.preguntas ?? [],
          nota: datos.nota ?? "",
          turnosRestantes: datos.turnosRestantes,
        },
        momento: datos.momento,
        items: (datos.items as ItemBorrador[]).map(conClave),
        texto: "",
      });
    } catch {
      setError("No se pudo conectar. Revisá la señal e intentá de nuevo.");
    } finally {
      setPensando(false);
    }
  }

  function guardar() {
    setError(null);
    iniciarGuardado(async () => {
      const resultado = await guardarComida({
        fecha,
        momento,
        origen: foto ? (estimacion ? "foto+descripcion" : "foto") : "descripcion",
        confianza: estimacion?.confianza ?? null,
        // Si hubo más de un turno, la estimación se afinó conversando.
        corregido: (estimacion?.turnosRestantes ?? LIMITES.turnosPorSesion) <
          LIMITES.turnosPorSesion - 1,
        nota: estimacion?.nota || null,
        scanSessionId: estimacion?.sessionId ?? null,
        items: items.map(aItemBorrador),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      // Ya está en el diario: dejar el borrador lo convertiría en una copia
      // que resucita la próxima vez que se abra Registrar.
      limpiarBorrador();
      router.push("/hoy");
    });
  }

  function empezarDeNuevo() {
    setEstado({
      texto: "",
      momento: momentoSugerido(new Date().getHours()),
      estimacion: null,
      items: [],
    });
    ponerFoto(null);
    limpiarBorrador();
    setError(null);
    setFueraDeTema(null);
    setFotoNoGuardada(false);
    setAvisoRecuperado(false);
  }

  const avisoDeRecuperacion = avisoRecuperado ? (
    <Aviso nivel="info">
      Recuperamos lo que habías dejado sin guardar. Si no era esto, tocá
      «Empezar de nuevo».
    </Aviso>
  ) : null;

  // ---------------------------------------------------------- entrada ---

  if (!estimacion) {
    return (
      <div className="space-y-4">
        {avisoDeRecuperacion}

        {/*
          Sin `capture`: con ese atributo el celular abre la cámara directo y
          no deja llegar a la galería. Muchas comidas se fotografían en el
          momento y se registran después —en la mesa uno come, no teclea—, y
          esa foto ya está en el carrete. Sin el atributo, el sistema ofrece
          las dos: cámara o galería.
        */}
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          onChange={elegirFoto}
          className="sr-only"
          id="foto"
        />

        {foto ? (
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-hairline-soft">
            {/*
              Con tope de altura: sin él, una foto vertical de celular ocupa la
              pantalla entera y empuja el botón de estimar fuera de la vista.
              Acá la foto se mira para confirmar que es la correcta, no para
              estudiarla — eso pasa después, en la pantalla de corregir.

              object-contain y no cover: recortar podría dejar fuera justo lo
              que se quiere comprobar que salió en la foto.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              // Una data: URL y no createObjectURL: el base64 es lo que
              // sobrevive a que el sistema descarte la página, mientras que un
              // blob URL muere con ella —y encima había que revocarlo a mano.
              src={`data:image/jpeg;base64,${foto.base64}`}
              alt="Foto de la comida"
              className="max-h-[45vh] w-full object-contain"
            />
            <button
              type="button"
              onClick={() => ponerFoto(null)}
              className="absolute top-2 right-2 rounded-full bg-ink/70 px-3 py-1.5 text-xs text-white"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label
            htmlFor="foto"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-surface px-4 py-6 text-sm text-ink-2"
          >
            Tomar o elegir una foto
          </label>
        )}

        <div>
          <textarea
            value={texto}
            onChange={(e) => actualizar({ texto: e.target.value })}
            maxLength={LIMITES.caracteresPorMensaje}
            rows={3}
            placeholder="2 arepas de media tela con quesito y 3 huevos en mantequilla"
            aria-label="Describí lo que comiste"
            className={`${claseControl} mt-0 resize-none`}
          />
          <p className="mt-1 text-xs text-muted">
            Con foto, con texto, o con las dos. El texto ayuda sobre todo con la
            preparación, que la foto no muestra.
          </p>
        </div>

        <button
          type="button"
          onClick={() => enviar(texto)}
          disabled={pensando || (!foto && texto.trim().length === 0)}
          className="w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
        >
          {pensando ? "Estimando…" : "Estimar"}
        </button>

        {fueraDeTema && <Aviso nivel="info">{fueraDeTema}</Aviso>}
        {error && <Aviso nivel="error">{error}</Aviso>}
      </div>
    );
  }

  // ------------------------------------------------------- estimación ---

  return (
    <div className="space-y-6">
      {avisoDeRecuperacion}

      <div>
        <TituloSeccion>Estimación</TituloSeccion>

        {fotoNoGuardada && (
          <div className="mb-3">
            <Aviso nivel="atencion">
              La estimación salió bien, pero la foto no se pudo archivar: esta
              comida va a quedar sin imagen en el diario. Suele ser que falta
              configurar el almacenamiento en Supabase.
            </Aviso>
          </div>
        )}

        <Tarjeta>
          <EditorItems
            items={items}
            alimentos={alimentos}
            onCambiar={(nuevos) => actualizar({ items: nuevos })}
          />

          {items.length === 0 && (
            <p className="text-sm text-muted">
              No quedó ningún ítem. Empezá de nuevo o registralo a mano.
            </p>
          )}

          <div className="mt-3 flex items-baseline justify-between border-t border-hairline-soft pt-3">
            <span className="text-sm text-ink-2">Total</span>
            <span className="font-mono text-sm text-ink tabular-nums">
              {Math.round(totales.kcal)} kcal
              <span className="text-muted">
                {" · "}
                {Math.round(totales.proteinaG)}P {Math.round(totales.carbsG)}C{" "}
                {Math.round(totales.grasaG)}G
              </span>
            </span>
          </div>

          <p className="mt-2 text-xs text-muted">
            {NOMBRE_CONFIANZA[estimacion.confianza]}
            {estimacion.nota && ` · ${estimacion.nota}`}
          </p>
        </Tarjeta>
      </div>

      {estimacion.preguntas.length > 0 && !sinTurnos && (
        <div>
          <TituloSeccion>Para afinar</TituloSeccion>
          <Tarjeta>
            <ul className="space-y-1.5">
              {estimacion.preguntas.map((pregunta) => (
                <li key={pregunta} className="text-sm text-ink-2">
                  {pregunta}
                </li>
              ))}
            </ul>

            <textarea
              value={texto}
              onChange={(e) => actualizar({ texto: e.target.value })}
              maxLength={LIMITES.caracteresPorMensaje}
              rows={2}
              placeholder="Dejé la mitad · era con mantequilla · el plato era compartido"
              aria-label="Responder para afinar la estimación"
              className={`${claseControl} resize-none`}
            />
            <button
              type="button"
              onClick={() => enviar(texto)}
              disabled={pensando || texto.trim().length === 0}
              className="mt-2 w-full rounded-xl border border-hairline px-4 py-2.5 text-sm text-ink-2 disabled:opacity-50"
            >
              {pensando ? "Ajustando…" : "Ajustar estimación"}
            </button>
            <p className="mt-2 text-xs text-muted">
              Quedan {estimacion.turnosRestantes}{" "}
              {estimacion.turnosRestantes === 1 ? "ajuste" : "ajustes"}. Después
              podés corregir los números a mano.
            </p>
          </Tarjeta>
        </div>
      )}

      {sinTurnos && (
        <Aviso nivel="info">
          Se acabaron los ajustes de esta comida. Corregí las porciones acá
          arriba y guardá — sale más rápido que seguir preguntando.
        </Aviso>
      )}

      {fueraDeTema && <Aviso nivel="info">{fueraDeTema}</Aviso>}

      <Tarjeta>
        <label className="block">
          <span className="text-sm font-medium text-ink-2">Momento</span>
          <select
            value={momento}
            onChange={(e) =>
              actualizar({
                momento: e.target.value as (typeof MOMENTOS)[number],
              })
            }
            className={claseControl}
          >
            {MOMENTOS.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MOMENTO[m]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={guardar}
          disabled={guardando || items.length === 0}
          className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar en el diario"}
        </button>

        <button
          type="button"
          onClick={empezarDeNuevo}
          className="mt-2 w-full rounded-xl border border-hairline px-4 py-2.5 text-sm text-ink-2"
        >
          Empezar de nuevo
        </button>

        {error && (
          <div className="mt-3">
            <Aviso nivel="error">{error}</Aviso>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

/** Deja solo lo que viaja al servidor: `clave` es de la UI. */
function aItemBorrador(item: ItemEditable): ItemBorrador {
  return {
    foodId: item.foodId,
    alimento: item.alimento,
    porcionG: item.porcionG,
    porcionMl: item.porcionMl,
    kcal: item.kcal,
    proteinaG: item.proteinaG,
    carbsG: item.carbsG,
    grasaG: item.grasaG,
    nota: item.nota,
  };
}

/** La clave de React se regenera al recuperar: no vale la pena guardarla. */
function conClave(item: ItemBorrador, i: number): ItemEditable {
  return { ...item, clave: `${i}-${crypto.randomUUID()}` };
}
