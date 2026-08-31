import { redirect } from "next/navigation";
import { fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { obtenerConsejos } from "@/lib/datos/consejos";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
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

  // El consejo principal se trae solo mirando hoy: en un día pasado es ruido,
  // porque el análisis siempre habla de la última semana.
  const [diario, consejos] = await Promise.all([
    obtenerDia(usuario.id, dia),
    dia === hoy ? obtenerConsejos(usuario.id) : null,
  ]);

  return (
    <VistaHoy
      dia={diario}
      esHoy={dia === hoy}
      hoy={hoy}
      consejo={consejos?.consejos[0] ?? null}
    />
  );
}
