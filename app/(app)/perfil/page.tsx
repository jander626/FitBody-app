import { redirect } from "next/navigation";
import { gastoDelMes, obtenerEstadoPerfil } from "@/lib/datos/perfil";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { VistaPerfil } from "./vista";

export const metadata = { title: "Perfil — FitFood" };

export default async function Perfil() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const [estado, gasto] = await Promise.all([
    obtenerEstadoPerfil(usuario.id),
    gastoDelMes(usuario.id),
  ]);

  return (
    <VistaPerfil
      estado={estado}
      gasto={gasto}
      tope={Number(process.env.FITFOOD_TOPE_MENSUAL_USD ?? 10)}
    />
  );
}
