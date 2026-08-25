"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Tarjeta, TituloSeccion, claseControl } from "@/components/ui";
import {
  detectarMetrica,
  fusionar,
  leerCsv,
  type DiaMetrica,
  type Metrica,
} from "@/lib/garmin/csv";
import { guardarDiasGarmin } from "./acciones";

/**
 * Subir los informes de Garmin.
 *
 * El CSV se lee acá, en el navegador, y **se muestra lo que se entendió antes
 * de guardar nada**. Una importación que escribe primero y avisa después es la
 * clase de cosa que uno no vuelve a usar cuando se equivoca una vez.
 *
 * La detección del informe se puede corregir a mano: Garmin le pone la misma
 * cabecera al de pasos y al de calorías, así que un archivo renombrado se
 * confunde, y exportar de nuevo por eso sería absurdo.
 */

const NOMBRE_METRICA: Record<Metrica, string> = {
  pasos: "Pasos",
  sueno: "Sueño",
  calorias: "Calorías",
  actividades: "Actividades",
};

interface Archivo {
  nombre: string;
  texto: string;
  metrica: Metrica | null;
}

export function SubirGarmin() {
  const router = useRouter();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<number | null>(null);
  const [guardando, iniciar] = useTransition();

  async function agregar(lista: FileList | null) {
    if (!lista) return;
    setError(null);
    setHecho(null);

    const nuevos: Archivo[] = [];
    for (const archivo of Array.from(lista)) {
      const texto = await archivo.text();
      nuevos.push({
        nombre: archivo.name,
        texto,
        metrica: detectarMetrica(texto, archivo.name),
      });
    }
    setArchivos((previos) => [...previos, ...nuevos]);
  }

  const lecturas = archivos
    .filter((a): a is Archivo & { metrica: Metrica } => a.metrica !== null)
    .map((a) => leerCsv(a.texto, a.metrica));

  const dias = fusionar(lecturas);
  const conCalorias = dias.filter((d) => d.kcalTotales !== undefined).length;

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarDiasGarmin(dias);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setHecho(r.guardados);
      setArchivos([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <TituloSeccion>Subir los informes</TituloSeccion>
        <Tarjeta>
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(e) => {
              void agregar(e.target.files);
              e.target.value = "";
            }}
            aria-label="Elegir archivos CSV de Garmin"
            className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-sobre-accent"
          />
          <p className="mt-3 text-xs text-muted">
            Podés soltar varios de una vez. Los rangos que se solapan se
            fusionan por día, así que no importa si repetís semanas.
          </p>
        </Tarjeta>
      </div>

      {hecho !== null && (
        <Aviso nivel="bien">
          Listo: {hecho} {hecho === 1 ? "día guardado" : "días guardados"}.
        </Aviso>
      )}
      {error && <Aviso nivel="error">{error}</Aviso>}

      {archivos.length > 0 && (
        <div>
          <TituloSeccion>Archivos</TituloSeccion>
          <Tarjeta className="space-y-3">
            {archivos.map((a, i) => (
              <div key={`${a.nombre}-${i}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {a.nombre}
                </span>
                <select
                  value={a.metrica ?? ""}
                  onChange={(e) =>
                    setArchivos((previos) =>
                      previos.map((x, j) =>
                        j === i
                          ? { ...x, metrica: (e.target.value || null) as Metrica | null }
                          : x,
                      ),
                    )
                  }
                  aria-label={`Qué informe es ${a.nombre}`}
                  className={`${claseControl} mt-0 w-auto py-1.5 text-xs`}
                >
                  <option value="">No reconocido</option>
                  {(Object.keys(NOMBRE_METRICA) as Metrica[]).map((m) => (
                    <option key={m} value={m}>
                      {NOMBRE_METRICA[m]}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {archivos.some((a) => a.metrica === null) && (
              <p className="text-xs text-muted">
                Un archivo sin reconocer no se lee. Elegí a mano qué informe es.
              </p>
            )}
          </Tarjeta>
        </div>
      )}

      {dias.length > 0 && (
        <div>
          <TituloSeccion>Esto es lo que entendí</TituloSeccion>

          {conCalorias === 0 && (
            <div className="mb-3">
              <Aviso nivel="info">
                Ninguno de estos informes trae calorías. Con pasos y sueño el
                gasto del día sigue saliendo de la fórmula, no del reloj. Si
                querés el gasto real, exportá también el informe de{" "}
                <strong>Calorías</strong> desde Garmin Connect.
              </Aviso>
            </div>
          )}

          <Tarjeta className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-muted">
                  <th className="px-4 py-2.5 text-left font-medium">Día</th>
                  <th className="px-2 py-2.5 text-right font-medium">Pasos</th>
                  <th className="px-2 py-2.5 text-right font-medium">Sueño</th>
                  <th className="px-2 py-2.5 text-right font-medium">FC rep.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Kcal</th>
                </tr>
              </thead>
              <tbody>
                {dias.slice(0, 40).map((d) => (
                  <Fila key={d.fecha} dia={d} />
                ))}
              </tbody>
            </table>
          </Tarjeta>

          <p className="mt-2 px-1 text-xs text-muted">
            {dias.length > 40 && `Se muestran 40 de ${dias.length}. Se guardan todos. `}
            Ojo con el último día: si exportaste temprano, va a medias. En los
            de arriba se ve enseguida —quedan muy por debajo del resto—, y si
            traen calorías conviene volver a exportarlo mañana, porque un día
            parcial deja un déficit que no fue.
          </p>

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-sobre-accent disabled:opacity-50"
          >
            {guardando
              ? "Guardando…"
              : `Guardar ${dias.length} ${dias.length === 1 ? "día" : "días"}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Fila({ dia }: { dia: DiaMetrica }) {
  return (
    <tr className="border-b border-hairline-soft last:border-0">
      <td className="px-4 py-2.5 text-ink">{dia.fecha.slice(5)}</td>
      <Celda valor={dia.pasos?.toLocaleString("es")} />
      <Celda valor={dia.suenoHoras === undefined ? undefined : `${dia.suenoHoras} h`} />
      <Celda valor={dia.fcReposo?.toString()} />
      <Celda
        valor={dia.kcalTotales?.toLocaleString("es")}
        clase="px-4 text-ink"
      />
    </tr>
  );
}

/** Un hueco se muestra como raya, no como cero: no midió no es midió cero. */
function Celda({ valor, clase = "px-2" }: { valor?: string; clase?: string }) {
  return (
    <td className={`py-2.5 text-right font-mono tabular-nums ${clase}`}>
      {valor ?? <span className="text-muted/50">—</span>}
    </td>
  );
}
