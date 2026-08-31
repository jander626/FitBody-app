import { redirect } from "next/navigation";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { VistaRegistrar } from "./vista";

export const metadata = { title: "Registrar — FitFood" };

export default async function Registrar() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const fecha = await fechaDeHoy();
  const [alimentos, dia] = await Promise.all([
    listarAlimentos(),
    // Hace falta para decir cómo encaja la comida: sin lo que ya llevás del
    // día, "500 kcal" no significa nada.
    obtenerDia(usuario.id, fecha),
  ]);

  return (
    <VistaRegistrar
      alimentos={alimentos}
      fecha={fecha}
      userId={usuario.id}
      objetivo={dia.objetivo}
      consumido={dia.totales}
    />
  );
}
