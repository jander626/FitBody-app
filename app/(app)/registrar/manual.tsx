"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import { BarraGuardar } from "@/components/barra-guardar";
import { EditorItems, type ItemEditable } from "@/components/editor-items";
import { ResumenComida } from "@/components/resumen-comida";
import { TuDia } from "@/components/tu-dia";
import { EscanerCodigo } from "@/components/escaner-codigo";
import { ProductoEscaneadoCard } from "@/components/producto-escaneado";
import { SenalesComida } from "@/components/senales-comida";
import type { ProductoEscaneado } from "@/lib/barcode/openfoodfacts";
import {
  buscarAlimentos,
  macrosDePorcion,
  porcionSugerida,
  type Alimento,
} from "@/lib/alimentos";
import {
  MOMENTOS,
  momentoSugerido,
  totalesDeItems,
  type Totales,
  type ItemBorrador,
} from "@/lib/registro/tipos";
import { guardarComida } from "./acciones";

export function RegistroManual({
  alimentos,
  fecha,
  momentoInicial,
  modo,
  alCambiarModo,
  activo = true,
  alCambiarRevision,
  alGuardar,
  objetivo,
  consumido,
}: {
  alimentos: Alimento[];
  fecha: string;
  /** La comida desde la que se llegó (el "+" de Hoy); si no, se sugiere por hora. */
  momentoInicial?: (typeof MOMENTOS)[number];
  /** "buscar" muestra la tabla; "codigo" abre el lector de códigos de barras. */
  modo: "buscar" | "codigo";
  /** Para salir del lector (al cerrar o al agregar un producto). */
  alCambiarModo: (modo: "buscar" | "codigo") => void;
  /** Si este modo está a la vista (los demás siguen montados, escondidos). */
  activo?: boolean;
  /** Avisa si hay una comida armada, para que la pantalla cambie sus barras. */
  alCambiarRevision?: (revisando: boolean) => void;
  /** Se guardó una comida: la pantalla padre muestra la celebración. */
  alGuardar?: (comida: Totales, momento: (typeof MOMENTOS)[number]) => void;
  objetivo: Totales | null;
  consumido: Totales;
}) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [momento, setMomento] = useState(
    () => momentoInicial ?? momentoSugerido(new Date().getHours()),
  );
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [error, setError] = useState<string | null>(null);
  // null = cerrado; sin código = cámara abierta; con código = ya se leyó uno.
  const [escaner, setEscaner] = useState<{ codigo: string | null } | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  const resultados = useMemo(
    () => buscarAlimentos(alimentos, consulta),
    [alimentos, consulta],
  );

  const totales = totalesDeItems(items);

  const hayComida = items.length > 0;
  useEffect(() => {
    alCambiarRevision?.(hayComida);
  }, [hayComida, alCambiarRevision]);

  function agregar(alimento: Alimento) {
    const gramos = porcionSugerida(alimento);
    setItems((previos) => [
      ...previos,
      {
        clave: `${alimento.id}-${Date.now()}`,
        foodId: alimento.id,
        alimento: alimento.nombre,
        porcionG: gramos,
        porcionMl: null,
        nota: null,
        ...macrosDePorcion(alimento, gramos),
      },
    ]);
    setConsulta("");
  }

  function agregarProducto(producto: ProductoEscaneado, gramos: number) {
    setItems((previos) => [
      ...previos,
      {
        clave: `${producto.codigo}-${Date.now()}`,
        // Sin enlace a la tabla: el producto no es un alimento propio, y así
        // cambiar la porción reescala lo que ya está calculado.
        foodId: null,
        alimento: producto.marca
          ? `${producto.nombre} (${producto.marca})`
          : producto.nombre,
        porcionG: gramos,
        porcionMl: null,
        nota: `Código de barras ${producto.codigo}`,
        ...macrosDePorcion(producto, gramos),
      },
    ]);
    setEscaner(null);
    // Con el producto ya en "Por guardar", se vuelve a la lista para verlo.
    alCambiarModo("buscar");
  }

  function guardar() {
    setError(null);
    iniciarGuardado(async () => {
      const resultado = await guardarComida({
        fecha,
        momento,
        origen: "manual",
        // Elegido de la tabla y con la porción puesta a mano: no hay estimación.
        confianza: "alta",
        corregido: false,
        nota: null,
        scanSessionId: null,
        items: items.map(aItemBorrador),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setItems([]);
      if (alGuardar) alGuardar(totales, momento);
      else router.push("/hoy");
    });
  }

  return (
    <div className="space-y-6">
      {items.length > 0 && (
        <div className="space-y-4">
          <ResumenComida items={items} totales={totales} />

          <Tarjeta>
            <EditorItems items={items} alimentos={alimentos} onCambiar={setItems} />
          </Tarjeta>

          <TuDia consumido={consumido} esta={totales} objetivo={objetivo} />

          <SenalesComida comida={totales} contexto={{ objetivo, consumido, momento }} />

          {/* La barra de modos se esconde mientras hay una comida armada: desde
              aquí se sigue agregando sin salir. */}
          <button
            type="button"
            onClick={() => alCambiarModo("codigo")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-hairline-soft py-3 text-sm font-medium text-ink-2"
          >
            Escanear otro producto
          </button>

          {error && <Aviso nivel="error">{error}</Aviso>}
        </div>
      )}

      <BarraGuardar
        activa={activo && items.length > 0}
        momento={momento}
        onMomento={setMomento}
        kcal={totales.kcal}
        guardando={guardando}
        deshabilitado={items.length === 0}
        onGuardar={guardar}
        onDescartar={() => setItems([])}
      />

      {modo === "codigo" && (
        <div>
          <Tarjeta>
            {escaner?.codigo == null ? (
              <EscanerCodigo
                onCodigo={(codigo) => setEscaner({ codigo })}
                onCerrar={() => {
                  setEscaner(null);
                  alCambiarModo("buscar");
                }}
              />
            ) : (
              <ProductoEscaneadoCard
                codigo={escaner.codigo}
                onAgregar={agregarProducto}
                onCancelar={() => setEscaner(null)}
              />
            )}
          </Tarjeta>
        </div>
      )}

      <div className={modo === "buscar" ? undefined : "hidden"}>
        <TituloSeccion>Buscar en la tabla</TituloSeccion>
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="arepa, pollo, chicharrón…"
          aria-label="Buscar un alimento"
          className={`${claseControl} mt-0`}
        />

        {consulta.trim() === "" && (
          // Sin esto el orden se lee como un alfabético roto.
          <p className="mt-2 px-1 text-xs text-muted">
            De más a menos proteína por 100 g.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {resultados.map((alimento) => (
            <li key={alimento.id}>
              <button
                type="button"
                onClick={() => agregar(alimento)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-3.5 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {alimento.nombre}
                  </span>
                  <span className="block text-xs text-muted">
                    {alimento.kcal100} kcal · {alimento.p100}P {alimento.c100}C{" "}
                    {alimento.g100}G por 100 g
                  </span>
                </span>
                <span className="shrink-0 text-xs text-accent">Agregar</span>
              </button>
            </li>
          ))}
        </ul>

        {resultados.length === 0 && (
          <p className="mt-3 text-sm text-muted">
            Nada con «{consulta}» en la tabla. Registralo por foto o por texto y
            queda estimado.
          </p>
        )}
      </div>
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
