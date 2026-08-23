import { redirect } from "next/navigation";
import { Encabezado } from "@/components/ui";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { fechaDeHoy } from "@/lib/datos/diario";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { RegistroManual } from "./manual";

export const metadata = { title: "Registrar — FitFood" };

export default async function Registrar() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const alimentos = await listarAlimentos();

  return (
    <>
      <Encabezado
        titulo="Registrar"
        bajada="Buscá en la tabla y ajustá la porción. Los números salen de la tabla, no de una estimación."
      />
      <div className="px-5">
        <RegistroManual alimentos={alimentos} fecha={fechaDeHoy()} />
      </div>
    </>
  );
}
