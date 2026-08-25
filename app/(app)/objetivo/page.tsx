import { redirect } from "next/navigation";
import { obtenerEstadoPerfil } from "@/lib/datos/perfil";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { Encuesta } from "./encuesta";

export const metadata = { title: "Tu objetivo — FitFood" };

export default async function PaginaObjetivo() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const estado = await obtenerEstadoPerfil(usuario.id);

  // Lo que ya se sabe llega precargado: nadie debería escribir su estatura dos
  // veces porque decidió revisar su objetivo.
  return (
    <Encuesta
      datosPrevios={{
        edad: estado.perfil.edad,
        sexo: estado.perfil.sexo,
        estaturaCm: estado.perfil.estaturaCm,
        pesoKg: estado.pesoActualKg,
      }}
    />
  );
}
