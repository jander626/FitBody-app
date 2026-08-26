import { redirect } from "next/navigation";
import { fechaDeHoy } from "@/lib/datos/diario";
import { obtenerEstadoPeso } from "@/lib/datos/peso";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { VistaPeso } from "./vista";

export const metadata = { title: "Peso — FitFood" };

export default async function Peso() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const hoy = await fechaDeHoy();
  return <VistaPeso estado={await obtenerEstadoPeso(usuario.id, hoy)} fecha={hoy} />;
}
