"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CamaraFoto } from "@/components/camara-foto";
import { useHidratado } from "@/components/hidratado";
import { PantallaRegistrada } from "@/components/pantalla-registrada";
import type { Alimento } from "@/lib/alimentos";
import type { MOMENTOS, Totales } from "@/lib/registro/tipos";
import { Conversacion } from "./conversacion";
import { RegistroManual } from "./manual";

type Modo = "foto" | "texto" | "buscar" | "codigo";

const MODOS: { id: Modo; etiqueta: string; titulo: string; icono: () => React.ReactElement }[] = [
  { id: "foto", etiqueta: "Foto", titulo: "Escanear comida", icono: IconoCamara },
  { id: "texto", etiqueta: "Texto", titulo: "Describir lo que comiste", icono: IconoTexto },
  { id: "buscar", etiqueta: "Buscar", titulo: "Buscar un alimento", icono: IconoLupa },
  { id: "codigo", etiqueta: "Código", titulo: "Código de barras", icono: IconoCodigo },
];

/**
 * Registrar como una pantalla de captura, no como un formulario.
 *
 * Cuatro formas de registrar y una barra abajo para cambiar entre ellas, con
 * la cámara como la primera: la comida se registra en la mesa, con el plato
 * delante, y el visor en vivo es el gesto más rápido. La barra de navegación
 * general se esconde acá (ver `navegacion.tsx`): sería una segunda barra
 * compitiendo con esta, y se sale con la ✕.
 *
 * Los tres modos de la tabla y la conversación quedan montados y solo se
 * esconde lo que no se ve. Antes un ternario montaba uno y desmontaba el otro,
 * y React tira el estado de lo que desmonta: estimabas una foto, te pasabas a
 * buscar para verificar una cantidad, y al volver se había ido una estimación
 * que costó una de las veinte llamadas del día.
 */
export function VistaRegistrar({
  alimentos,
  fecha,
  userId,
  momentoInicial,
  objetivo,
  consumido,
  hoy,
  semana,
  registrados,
  racha,
  yaRegistradoHoy,
}: {
  alimentos: Alimento[];
  fecha: string;
  userId: string;
  /** La comida desde la que se llegó (el "+" de Hoy); si no, se sugiere por hora. */
  momentoInicial?: (typeof MOMENTOS)[number];
  objetivo: Totales | null;
  consumido: Totales;
  /** Para la celebración de después de guardar. */
  hoy: string;
  semana: string[];
  registrados: string[];
  racha: number;
  yaRegistradoHoy: boolean;
}) {
  const router = useRouter();
  const hidratado = useHidratado();
  const [modo, setModo] = useState<Modo>("foto");
  // Hasta saber si hay un borrador sin guardar no se enciende la cámara: si lo
  // hay, el modo correcto es el de texto, donde está lo que se dejó a medias.
  const [revisado, setRevisado] = useState(false);
  const [foto, setFoto] = useState<{ archivo: File; n: number } | null>(null);
  // Si hay una comida armada, la barra de guardar ocupa el lugar de la de modos.
  const [revisando, setRevisando] = useState({ texto: false, manual: false });
  const [guardada, setGuardada] = useState<Totales | null>(null);
  const revisaTexto = useCallback((v: boolean) => setRevisando((p) => ({ ...p, texto: v })), []);
  const revisaManual = useCallback((v: boolean) => setRevisando((p) => ({ ...p, manual: v })), []);
  const alGuardar = useCallback((comida: Totales) => setGuardada(comida), []);

  const barraDeModos = !(modo === "texto" ? revisando.texto : modo === "buscar" || modo === "codigo" ? revisando.manual : false);

  const indice = MODOS.findIndex((m) => m.id === modo);
  const actual = MODOS[indice];

  return (
    <>
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link
          href="/hoy"
          aria-label="Cerrar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </Link>
        <h1 key={modo} className="pop flex-1 pr-11 text-center font-serif text-xl text-ink">
          {actual.titulo}
        </h1>
      </header>

      <div className="px-5 pb-4">
        {modo === "foto" && revisado && (
          <div className="entra pt-2">
            <CamaraFoto
              onFoto={(archivo) => {
                setFoto((previa) => ({ archivo, n: (previa?.n ?? 0) + 1 }));
                // Con la foto tomada se pasa al panel donde se ve y se estima.
                setModo("texto");
              }}
            />
          </div>
        )}

        <div className={modo === "texto" ? "entra" : "hidden"}>
          <Conversacion
            alimentos={alimentos}
            fecha={fecha}
            userId={userId}
            momentoInicial={momentoInicial}
            fotoExterna={foto}
            alRevisarBorrador={(hay) => {
              if (hay) setModo("texto");
              setRevisado(true);
            }}
            activo={modo === "texto"}
            alCambiarRevision={revisaTexto}
            alGuardar={alGuardar}
            objetivo={objetivo}
            consumido={consumido}
          />
        </div>

        <div className={modo === "buscar" || modo === "codigo" ? "entra" : "hidden"}>
          <RegistroManual
            alimentos={alimentos}
            fecha={fecha}
            momentoInicial={momentoInicial}
            modo={modo === "codigo" ? "codigo" : "buscar"}
            alCambiarModo={setModo}
            activo={modo === "buscar" || modo === "codigo"}
            alCambiarRevision={revisaManual}
            alGuardar={alGuardar}
            objetivo={objetivo}
            consumido={consumido}
          />
        </div>
      </div>

      {/* La barra va directamente en <body>, no dentro de la pantalla: un
          `position: fixed` dentro de un elemento animado se pega a ese elemento
          en WebKit (iPhone) y no a la pantalla, y la barra terminaba encima del
          obturador. Un portal la saca de ahí sin importar qué animaciones haya
          arriba, ahora o dentro de un año. */}
      {hidratado &&
        barraDeModos &&
        createPortal(
      <nav
        aria-label="Forma de registrar"
        className="fixed inset-x-0 z-10 mx-auto max-w-md px-4"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div role="tablist" className="relative grid grid-cols-4 rounded-full border border-hairline bg-surface/90 p-1.5 shadow-[var(--shadow)] backdrop-blur-md">
          {/* La pastilla que sigue al modo elegido, como en la barra general. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 rounded-full bg-accent-soft transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ width: "calc((100% - 0.75rem) / 4)", transform: `translateX(${indice * 100}%)` }}
          />
          {MODOS.map(({ id, etiqueta, icono: Icono }) => (
            <button
              key={id}
              role="tab"
              aria-selected={modo === id}
              onClick={() => setModo(id)}
              className={`relative flex flex-col items-center gap-0.5 rounded-full py-2.5 text-[11px] transition-colors ${
                modo === id ? "font-medium text-accent" : "text-muted"
              }`}
            >
              <Icono />
              {etiqueta}
            </button>
          ))}
        </div>
      </nav>,
          document.body,
        )}

      {guardada && (
        <PantallaRegistrada
          primeraDelDia={!yaRegistradoHoy}
          racha={racha}
          semana={semana}
          registrados={registrados}
          hoy={hoy}
          antes={consumido}
          despues={{
            kcal: consumido.kcal + guardada.kcal,
            proteinaG: consumido.proteinaG + guardada.proteinaG,
            carbsG: consumido.carbsG + guardada.carbsG,
            grasaG: consumido.grasaG + guardada.grasaG,
          }}
          objetivo={objetivo}
          onContinuar={() => router.push("/hoy")}
        />
      )}
    </>
  );
}

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.6h6.6l1 1.6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconoTexto() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path d="M4 18l4.5-12L13 18M5.7 14h5.6M17 7v10M15 7h4M15 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoLupa() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconoCodigo() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 9v6M11 9v6M14 9v6M16.5 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
