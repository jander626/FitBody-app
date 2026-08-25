import { redirect } from "next/navigation";
import { fechaDeHoy } from "@/lib/datos/diario";
import { obtenerHistorial } from "@/lib/datos/historial";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { VistaHistorial } from "./vista";

export const metadata = { title: "Historial — FitFood" };

export default async function Historial() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  return (
    <VistaHistorial
      historial={await obtenerHistorial(usuario.id)}
      hoy={fechaDeHoy()}
    />
  );
}
