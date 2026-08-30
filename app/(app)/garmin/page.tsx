import Link from "next/link";
import { redirect } from "next/navigation";
import { Encabezado, Tarjeta, TituloSeccion } from "@/components/ui";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { obtenerMetricas } from "@/lib/datos/metricas";
import { fechaDeHoy } from "@/lib/datos/diario";
import { CaloriasAMano } from "./calorias-a-mano";
import { SubirGarmin } from "./subir";

export default async function PaginaGarmin() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [metricas, hoy] = await Promise.all([
    obtenerMetricas(user.id),
    fechaDeHoy(),
  ]);
  const conCalorias = metricas.filter((m) => m.kcalTotales !== null).length;

  const kcalPorFecha = Object.fromEntries(
    metricas.map((m) => [m.fecha, m.kcalTotales]),
  );

  return (
    <>
      <Encabezado
        titulo="Garmin"
        bajada={
          metricas.length === 0
            ? "Todavía no hay días importados"
            : `${metricas.length} días importados`
        }
      />

      <div className="space-y-6 px-5">
        <SubirGarmin />

        <div>
          <TituloSeccion>Calorías a mano</TituloSeccion>
          <CaloriasAMano hoy={hoy} guardadas={kcalPorFecha} />
        </div>

        <div>
          <TituloSeccion>Cómo exportar desde Garmin</TituloSeccion>
          <Tarjeta className="space-y-3 text-sm text-ink-2">
            <p>
              En <strong>Garmin Connect</strong> desde el navegador (en la app
              del celular no está la opción de exportar):
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Entrá a la sección de informes de bienestar.</li>
              <li>
                Elegí el informe: <strong>Pasos</strong>,{" "}
                <strong>Sueño</strong> o <strong>Calorías</strong>.
              </li>
              <li>Poné el rango de fechas que quieras.</li>
              <li>Exportá a CSV y subí el archivo acá.</li>
            </ol>
            <p className="text-xs text-muted">
              El de <strong>Calorías</strong> es el que importa para el gasto
              real: los de pasos y sueño no traen calorías. Sin él, el gasto se
              sigue estimando con tu peso, estatura y edad. Si ese informe no
              te ofrece exportar CSV, escribí los totales a mano acá arriba —
              son siete números por semana.
            </p>
          </Tarjeta>
        </div>

        {metricas.length > 0 && (
          <div>
            <TituloSeccion>Lo que ya está guardado</TituloSeccion>
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
                  {metricas.slice(0, 30).map((m) => (
                    <tr
                      key={m.fecha}
                      className="border-b border-hairline-soft last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/hoy?fecha=${m.fecha}`}
                          className="text-ink underline-offset-4 hover:underline"
                        >
                          {m.fecha.slice(5)}
                        </Link>
                      </td>
                      <Celda valor={m.pasos?.toLocaleString("es")} />
                      <Celda valor={m.suenoHoras ? `${m.suenoHoras} h` : null} />
                      <Celda valor={m.fcReposo?.toString()} />
                      <Celda
                        valor={m.kcalTotales?.toLocaleString("es")}
                        clase="px-4 text-ink"
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>

            <p className="mt-2 px-1 text-xs text-muted">
              {conCalorias === 0
                ? "Ningún día tiene calorías del reloj: el gasto se sigue estimando."
                : `${conCalorias} de ${metricas.length} días usan el gasto medido por el reloj.`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/** Un hueco es una raya. No medir no es medir cero. */
function Celda({
  valor,
  clase = "px-2",
}: {
  valor?: string | null;
  clase?: string;
}) {
  return (
    <td className={`py-2.5 text-right font-mono tabular-nums ${clase}`}>
      {valor ?? <span className="text-muted/50">—</span>}
    </td>
  );
}
