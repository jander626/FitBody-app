import { redirect } from "next/navigation";
import { fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
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

  return (
    <VistaHoy
      dia={await obtenerDia(usuario.id, dia)}
      esHoy={dia === hoy}
      hoy={hoy}
    />
  );
}
