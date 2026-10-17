import { redirect } from "next/navigation";
import { obtenerEstadoPerfil } from "@/lib/datos/perfil";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { Entrada } from "./entrada";

export const metadata = { title: "Crea tu plan — FitFood" };

export default async function Empezar(props: PageProps<"/empezar">) {
  const { rehacer } = await props.searchParams;

  if (rehacer !== "1") return <Entrada />;

  // Rehacer el plan solo tiene sentido con sesión; las respuestas de partida son
  // las que ya se conocen, para que nadie vuelva a decir su estatura.
  const usuario = await usuarioActual();
  if (!usuario) redirect("/empezar");
  const estado = await obtenerEstadoPerfil(usuario.id);

  return (
    <Entrada
      rehacer
      inicial={{
        sexo: estado.perfil.sexo,
        edad: estado.perfil.edad,
        estatura: estado.perfil.estaturaCm,
        peso: estado.pesoActualKg,
      }}
    />
  );
}
