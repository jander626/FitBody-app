import { redirect } from "next/navigation";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { fechaDeHoy } from "@/lib/datos/diario";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { VistaRegistrar } from "./vista";

export const metadata = { title: "Registrar — FitFood" };

export default async function Registrar() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  return (
    <VistaRegistrar
      alimentos={await listarAlimentos()}
      fecha={fechaDeHoy()}
      userId={usuario.id}
    />
  );
}
