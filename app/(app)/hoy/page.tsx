import { redirect } from "next/navigation";
import { diasConRegistro, fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { haceDias, racha } from "@/lib/racha";
import { semanaDe } from "@/lib/semana";
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
  const semana = semanaDe(dia);
  // La racha mira 60 días hacia atrás desde hoy; la franja, la semana que se
  // ve. Una sola consulta cubriría las dos, pero la semana puede ser antigua.
  const [diario, consejos, registrados, recientes] = await Promise.all([
    obtenerDia(usuario.id, dia),
    dia === hoy ? obtenerConsejos(usuario.id) : null,
    diasConRegistro(usuario.id, semana),
    diasConRegistro(usuario.id, [haceDias(hoy, 60), hoy]),
  ]);

  // Primera vez: sin objetivo ni comidas no hay nada que mostrar, y la pantalla
  // vacía no dice qué hacer. La encuesta arma el objetivo en un minuto.
  if (dia === hoy && !diario.objetivo && diario.comidas.length === 0) {
    redirect("/objetivo");
  }

  return (
    <VistaHoy
      dia={diario}
      esHoy={dia === hoy}
      hoy={hoy}
      semana={semana}
      registrados={registrados}
      racha={racha(recientes, hoy)}
      consejo={consejos?.consejos[0] ?? null}
    />
  );
}
