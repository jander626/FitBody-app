import { Suspense } from "react";
import { redirect } from "next/navigation";
import { fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { registroReciente } from "@/lib/datos/semana";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { ConsejoDelDia } from "./consejo-del-dia";
import { VistaHoy } from "./vista";

export const metadata = { title: "Hoy — FitFood" };

export default async function Hoy(props: PageProps<"/hoy">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const { fecha } = await props.searchParams;
  const hoy = await fechaDeHoy();
  // Permite mirar días anteriores con ?fecha=AAAA-MM-DD sin abrir otra pantalla.
  const dia =
    typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy;

  const [diario, reciente] = await Promise.all([
    obtenerDia(usuario.id, dia),
    registroReciente(usuario.id, dia, hoy),
  ]);

  // Primera vez: sin objetivo ni comidas no hay nada que mostrar, y la pantalla
  // vacía no dice qué hacer. La encuesta arma el objetivo en un minuto.
  if (dia === hoy && !diario.objetivo && diario.comidas.length === 0) {
    redirect("/empezar?rehacer=1");
  }

  return (
    <VistaHoy
      dia={diario}
      esHoy={dia === hoy}
      hoy={hoy}
      semana={reciente.semana}
      registrados={reciente.registrados}
      racha={reciente.racha}
      // El consejo es lo más lento de calcular, así que llega después: el resto
      // de la pantalla no lo espera. Solo mirando hoy; en un día pasado es
      // ruido, porque el análisis siempre habla de la última semana.
      consejo={
        dia === hoy ? (
          <Suspense fallback={<div className="h-32 animate-pulse rounded-3xl bg-hairline-soft" />}>
            <ConsejoDelDia usuarioId={usuario.id} />
          </Suspense>
        ) : null
      }
    />
  );
}
