import { redirect } from "next/navigation";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { diasConRegistro, fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { haceDias, racha } from "@/lib/racha";
import { semanaDe } from "@/lib/semana";
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
  const semana = semanaDe(fecha);
  const [alimentos, dia, registrados, recientes] = await Promise.all([
    listarAlimentos(),
    // Hace falta para decir cómo encaja la comida: sin lo que ya llevás del
    // día, "500 kcal" no significa nada.
    obtenerDia(usuario.id, fecha),
    // Para la celebración de después de guardar: la semana y la racha.
    diasConRegistro(usuario.id, semana),
    diasConRegistro(usuario.id, [haceDias(fecha, 60), fecha]),
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
      semana={semana}
      registrados={registrados}
      racha={racha(recientes, fecha)}
      yaRegistradoHoy={dia.comidas.length > 0}
    />
  );
}
