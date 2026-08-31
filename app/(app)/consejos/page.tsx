import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso, Encabezado, Tarjeta, TituloSeccion } from "@/components/ui";
import { TarjetaConsejo } from "@/components/tarjeta-consejo";
import { obtenerConsejos } from "@/lib/datos/consejos";
import { VENTANA_DIAS } from "@/lib/coach/consejos";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";

export const metadata = { title: "Consejos — FitFood" };

export default async function Consejos() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const { consejos, diasAnalizados, hayObjetivo } = await obtenerConsejos(
    usuario.id,
  );

  return (
    <>
      <Encabezado
        titulo="Consejos"
        bajada={
          diasAnalizados > 0
            ? `De tus últimos ${diasAnalizados} ${diasAnalizados === 1 ? "día" : "días"} con registro`
            : "Todavía sin días para analizar"
        }
      />

      <div className="space-y-6 px-5">
        {!hayObjetivo && (
          <div>
            <Aviso nivel="info">
              Sin un objetivo configurado no hay contra qué comparar lo que
              comés.
            </Aviso>
            <Link
              href="/objetivo"
              className="mt-3 block rounded-xl bg-accent px-4 py-3 text-center text-base font-medium text-sobre-accent"
            >
              Calcular mi plan
            </Link>
          </div>
        )}

        {consejos.length === 0 ? (
          <Tarjeta>
            <p className="text-sm text-ink-2">
              No hay nada que señalar esta semana. No es un error de la app:
              cuando todo va como debe, inventar una observación para llenar la
              pantalla le quita valor a las veces que sí hay algo.
            </p>
          </Tarjeta>
        ) : (
          <div className="space-y-3">
            {consejos.map((c) => (
              <TarjetaConsejo key={c.id} consejo={c} />
            ))}
          </div>
        )}

        <div>
          <TituloSeccion>De dónde sale esto</TituloSeccion>
          <Tarjeta className="space-y-3 text-sm text-ink-2">
            <p>
              Son reglas sobre tus propios datos de los últimos{" "}
              {VENTANA_DIAS} días, no un texto generado. Por eso cada consejo
              trae las cifras al lado: si el número está mal, se ve.
            </p>
            <p>
              Cuando dos cosas se mueven juntas —dormir poco y comer de más— la
              app dice que van juntas, no que una causa la otra. Con dos semanas
              de datos no hay forma de saberlo.
            </p>
            <p className="text-xs text-muted">
              La tabla de alimentos tiene calorías y los tres macros, nada más:
              no hay fibra ni micronutrientes. Nada de esto reemplaza a un
              profesional de la salud.
            </p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
