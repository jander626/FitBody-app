/**
 * La pantalla de Perfil sin acceso a datos.
 *
 * Separar la vista de la carga permite renderizarla con datos de ejemplo
 * (scripts/muestras.ts) y revisarla sin una sesión real.
 */
import Link from "next/link";
import { Aviso, Dato, Encabezado, Tarjeta, TituloSeccion } from "@/components/ui";
import type { EstadoPerfil } from "@/lib/datos/perfil";
import { cerrarSesion } from "../acciones";
import { FormularioPerfil } from "./formulario";

export function VistaPerfil({
  estado,
  gasto,
  tope,
}: {
  estado: EstadoPerfil;
  gasto: number;
  tope: number;
}) {
  const { perfil, objetivo, pesoActualKg, planRecalculado: plan } = estado;

  // El objetivo guardado puede haberse quedado viejo respecto al peso de hoy:
  // el plan se calcula con el peso, y el peso cambia todos los días.
  //
  // Se comparan también las macros, no solo las calorías. Bajar de 79.4 a 78.2
  // kg deja el objetivo en las mismas 1850 kcal pero mueve la proteína de 160
  // a 155 g: mirando solo las calorías, ese desfase pasaría desapercibido.
  const desfasado =
    plan !== null &&
    objetivo !== null &&
    (plan.kcalObjetivo !== objetivo.kcal ||
      plan.proteinaG !== objetivo.proteinaG ||
      plan.carbsG !== objetivo.carbsG ||
      plan.grasaG !== objetivo.grasaG);

  const pctGasto = tope > 0 ? Math.min(100, (gasto / tope) * 100) : 0;

  return (
    <>
      <Encabezado
        titulo="Perfil"
        bajada={
          perfil.fechaDia1
            ? `Día 1 del plan: ${perfil.fechaDia1}`
            : "Todavía sin plan configurado"
        }
      />

      <div className="space-y-6 px-5">
        {plan && (
          <div>
            <TituloSeccion>Tu plan de hoy</TituloSeccion>
            <Tarjeta>
              <Dato
                etiqueta="Objetivo diario"
                valor={plan.kcalObjetivo}
                detalle="kcal"
              />
              <div className="my-2 border-t border-hairline-soft" />
              <Dato etiqueta="Proteína" valor={plan.proteinaG} detalle="g" />
              <Dato etiqueta="Carbohidratos" valor={plan.carbsG} detalle="g" />
              <Dato etiqueta="Grasa" valor={plan.grasaG} detalle="g" />
              <div className="my-2 border-t border-hairline-soft" />
              <Dato
                etiqueta="Metabolismo basal"
                valor={Math.round(plan.tmbKcal)}
                detalle="kcal"
              />
              <Dato
                etiqueta="Gasto total estimado"
                valor={plan.tdeeKcal}
                detalle="kcal"
              />
              <Dato
                etiqueta="Ritmo esperado"
                valor={`${plan.ritmoEsperadoKgSemana.min.toFixed(2)} a ${plan.ritmoEsperadoKgSemana.max.toFixed(2)}`}
                detalle="kg/semana"
              />
            </Tarjeta>

            {desfasado && (
              <div className="mt-3">
                <Aviso nivel="info">
                  Con tu peso de hoy el plan daría {plan.kcalObjetivo} kcal y{" "}
                  {plan.proteinaG}P/{plan.carbsG}C/{plan.grasaG}G; lo guardado
                  es {objetivo!.kcal} kcal y {objetivo!.proteinaG}P/
                  {objetivo!.carbsG}C/{objetivo!.grasaG}G. Guardá el formulario
                  para actualizarlo.
                </Aviso>
              </div>
            )}

            {plan.avisos.map((aviso, i) => (
              <div key={i} className="mt-3">
                <Aviso nivel={aviso.nivel}>{aviso.mensaje}</Aviso>
              </div>
            ))}
          </div>
        )}

        <div>
          <TituloSeccion>Tus datos</TituloSeccion>
          <Tarjeta>
            <FormularioPerfil
              perfil={perfil}
              objetivo={objetivo}
              pesoActualKg={pesoActualKg}
            />
          </Tarjeta>
        </div>

        <div>
          <TituloSeccion>Reloj</TituloSeccion>
          <Tarjeta>
            <p className="text-sm text-ink-2">
              Importá los informes de Garmin Connect y el gasto de cada día
              pasa a ser el que midió el reloj, en vez del que calcula la
              fórmula con tu peso y tu edad.
            </p>
            <Link
              href="/garmin"
              className="mt-3 block rounded-xl border border-hairline px-4 py-3 text-center text-base font-medium text-ink"
            >
              Importar datos de Garmin
            </Link>
          </Tarjeta>
        </div>

        <div>
          <TituloSeccion>Gasto de IA este mes</TituloSeccion>
          <Tarjeta>
            <Dato
              etiqueta="Acumulado"
              valor={`$${gasto.toFixed(2)}`}
              detalle={`de $${tope.toFixed(2)}`}
            />
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-hairline-soft"
              role="img"
              aria-label={`${Math.round(pctGasto)} por ciento del tope mensual`}
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${pctGasto}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Al llegar al tope se bloquea la IA. El buscador y el registro
              manual siguen funcionando.
            </p>
          </Tarjeta>
        </div>

        <form action={cerrarSesion} className="pb-4">
          <button
            type="submit"
            className="w-full rounded-xl border border-hairline px-4 py-3 text-sm text-ink-2"
          >
            Cerrar sesión
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            Esto no es consejo médico. Es un sistema de seguimiento.
          </p>
        </form>
      </div>
    </>
  );
}
