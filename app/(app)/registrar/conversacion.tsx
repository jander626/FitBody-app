"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import { EditorItems, type ItemEditable } from "@/components/editor-items";
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
import { clienteNavegador } from "@/lib/supabase/cliente-navegador";
import { guardarComida } from "./acciones";

interface Estimacion {
  sessionId: string;
  momento: (typeof MOMENTOS)[number];
  confianza: "alta" | "media" | "baja";
  preguntas: string[];
  nota: string;
  turnosRestantes: number;
}

const NOMBRE_CONFIANZA: Record<string, string> = {
  alta: "Confianza alta",
  media: "Confianza media",
  baja: "Confianza baja",
};

export function Conversacion({
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

  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<{ url: string; base64: string } | null>(null);
  const [estimacion, setEstimacion] = useState<Estimacion | null>(null);
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [momento, setMomento] = useState(() =>
    momentoSugerido(new Date().getHours()),
  );
  const [error, setError] = useState<string | null>(null);
  const [fueraDeTema, setFueraDeTema] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const [guardando, iniciarGuardado] = useTransition();

  const totales = totalesDeItems(items);
  const sinTurnos = estimacion !== null && estimacion.turnosRestantes <= 0;

  async function elegirFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setError(null);
    try {
      const comprimida = await comprimirFoto(archivo);
      setFoto({
        url: URL.createObjectURL(comprimida.blob),
        base64: comprimida.base64,
      });
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
    setPensando(true);

    try {
      const fotoPath =
        foto && !estimacion ? await subirFoto(foto.base64) : null;

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
        setEstimacion((previa) =>
          previa ? { ...previa, turnosRestantes: datos.turnosRestantes } : previa,
        );
        return;
      }

      setEstimacion({
        sessionId: datos.sessionId,
        momento: datos.momento,
        confianza: datos.confianza,
        preguntas: datos.preguntas ?? [],
        nota: datos.nota ?? "",
        turnosRestantes: datos.turnosRestantes,
      });
      setMomento(datos.momento);
      setItems(
        (datos.items as ItemBorrador[]).map((item, i) => ({
          ...item,
          clave: `${i}-${Date.now()}`,
        })),
      );
      setTexto("");
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
      router.push("/hoy");
    });
  }

  function empezarDeNuevo() {
    setEstimacion(null);
    setItems([]);
    setFoto(null);
    setTexto("");
    setError(null);
    setFueraDeTema(null);
    if (inputFoto.current) inputFoto.current.value = "";
  }

  // ---------------------------------------------------------- entrada ---

  if (!estimacion) {
    return (
      <div className="space-y-4">
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
          <div className="relative overflow-hidden rounded-2xl border border-hairline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt="Foto de la comida" className="w-full" />
            <button
              type="button"
              onClick={() => {
                setFoto(null);
                if (inputFoto.current) inputFoto.current.value = "";
              }}
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
            onChange={(e) => setTexto(e.target.value)}
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
          className="w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
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
      <div>
        <TituloSeccion>Estimación</TituloSeccion>
        <Tarjeta>
          <EditorItems
            items={items}
            alimentos={alimentos}
            onCambiar={setItems}
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
              onChange={(e) => setTexto(e.target.value)}
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
              setMomento(e.target.value as (typeof MOMENTOS)[number])
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
          className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-50"
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
