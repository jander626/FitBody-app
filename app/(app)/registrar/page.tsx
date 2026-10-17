import { redirect } from "next/navigation";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { registroReciente } from "@/lib/datos/semana";
import { MOMENTOS } from "@/lib/registro/tipos";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { VistaRegistrar } from "./vista";

export const metadata = { title: "Registrar — FitFood" };

export default async function Registrar(props: PageProps<"/registrar">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const { momento } = await props.searchParams;
  const momentoInicial =
    typeof momento === "string" && (MOMENTOS as readonly string[]).includes(momento)
      ? (momento as (typeof MOMENTOS)[number])
      : undefined;

  const fecha = await fechaDeHoy();
  const [alimentos, dia, reciente] = await Promise.all([
    listarAlimentos(),
    // Hace falta para decir cómo encaja la comida: sin lo que ya llevás del
    // día, "500 kcal" no significa nada.
    obtenerDia(usuario.id, fecha),
    // Para la celebración de después de guardar: la semana y la racha.
    registroReciente(usuario.id, fecha, fecha),
  ]);

  return (
    <VistaRegistrar
      alimentos={alimentos}
      fecha={fecha}
      userId={usuario.id}
      momentoInicial={momentoInicial}
      objetivo={dia.objetivo}
      consumido={dia.totales}
      hoy={fecha}
      semana={reciente.semana}
      registrados={reciente.registrados}
      racha={reciente.racha}
      yaRegistradoHoy={dia.comidas.length > 0}
    />
  );
}
