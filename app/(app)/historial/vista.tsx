import Link from "next/link";
import { Aviso, Dato, Encabezado, Tarjeta, TituloSeccion } from "@/components/ui";
import { Balance } from "@/components/balance";
import { Calendario } from "@/components/calendario";
import type { Historial } from "@/lib/datos/historial";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaCorta(fecha: string): string {
  return `${Number(fecha.slice(8, 10))} ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
}

export function VistaHistorial({
  historial,
  hoy,
}: {
  historial: Historial;
  hoy: string;
}) {
  const { dias, objetivo, gastoKcal, promedio } = historial;

  if (dias.length === 0) {
    return (
      <>
        <Encabezado titulo="Historial" />
        <div className="px-5">
          <Tarjeta>
            <p className="text-sm text-ink-2">
              Todavía no hay días registrados. En cuanto guardes tu primera
              comida, acá vas a ver el resumen.
            </p>
            <Link
              href="/registrar"
              className="mt-3 block rounded-xl bg-accent px-4 py-3 text-center text-base font-medium text-white"
            >
              Registrar una comida
            </Link>
          </Tarjeta>
        </div>
      </>
    );
  }

  return (
    <>
      <Encabezado
        titulo="Historial"
        bajada={`${dias.length} ${dias.length === 1 ? "día registrado" : "días registrados"}`}
      />

      <div className="space-y-6 px-5">
        {!objetivo && (
          <Aviso nivel="info">
            Falta configurar tu objetivo en Perfil. Sin él no se puede decir si
            un día se cumplió o no, así que los días salen sin color.
          </Aviso>
        )}

        {promedio && (
          <div>
            <TituloSeccion>Promedio de {promedio.dias} días</TituloSeccion>
            <Tarjeta>
              <Dato etiqueta="Calorías" valor={promedio.kcal} detalle="kcal/día" />
              <Dato
                etiqueta="Déficit real"
                valor={promedio.deficit > 0 ? `−${promedio.deficit}` : `+${-promedio.deficit}`}
                detalle="kcal/día"
              />
              <div className="my-2 border-t border-hairline-soft" />
              <Dato etiqueta="Proteína" valor={promedio.proteinaG} detalle="g" />
              <Dato etiqueta="Carbohidratos" valor={promedio.carbsG} detalle="g" />
              <Dato etiqueta="Grasa" valor={promedio.grasaG} detalle="g" />
              <div className="my-2 border-t border-hairline-soft" />
              <Dato
                etiqueta="Días dentro del objetivo"
                valor={`${promedio.enObjetivo} de ${promedio.dias}`}
              />
              {promedio.deficit > 0 && (
                <p className="mt-2 text-xs text-muted">
                  A este ritmo son unos{" "}
                  {((promedio.deficit * 7) / 7700).toFixed(2)} kg por semana.
                </p>
              )}
            </Tarjeta>
          </div>
        )}

        <div>
          <TituloSeccion>Elegí un día</TituloSeccion>
          <Tarjeta>
            <Calendario dias={dias} hoy={hoy} />
          </Tarjeta>
        </div>

        {objetivo && gastoKcal !== null && (
          <div>
            <TituloSeccion>Balance calórico</TituloSeccion>
            <Tarjeta>
              <Balance
                dias={dias.slice(0, 30)}
                objetivoKcal={objetivo.kcal}
                gastoKcal={gastoKcal}
              />
            </Tarjeta>
          </div>
        )}

        <div>
          <TituloSeccion>Registro diario</TituloSeccion>
          <Tarjeta className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs text-muted">
                  <th className="px-4 py-2.5 text-left font-medium">Día</th>
                  <th className="px-2 py-2.5 text-right font-medium">Kcal</th>
                  <th className="px-2 py-2.5 text-right font-medium">Prot.</th>
                  <th className="px-2 py-2.5 text-right font-medium">Carb.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Grasa</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((d) => (
                  <tr
                    key={d.fecha}
                    className="border-b border-hairline-soft last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={d.fecha === hoy ? "/hoy" : `/hoy?fecha=${d.fecha}`}
                        className="text-ink underline-offset-4 hover:underline"
                      >
                        {fechaCorta(d.fecha)}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-ink">
                      {Math.round(d.kcal).toLocaleString("es")}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-ink-2">
                      {Math.round(d.proteinaG)}
                      {objetivo && (
                        <span
                          className={`ml-1 text-xs ${
                            d.pctProteina >= 100 ? "text-good" : "text-muted"
                          }`}
                        >
                          {d.pctProteina}%
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-ink-2">
                      {Math.round(d.carbsG)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-ink-2">
                      {Math.round(d.grasaG)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
          <p className="mt-2 px-1 text-xs text-muted">
            Tocá un día para ver el detalle de cada comida. Los gramos son de
            proteína, carbohidratos y grasa.
          </p>
        </div>
      </div>
    </>
  );
}
