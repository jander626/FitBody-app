import { notFound, redirect } from "next/navigation";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { obtenerComida } from "@/lib/datos/diario";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { EditarComida } from "./editar";

export const metadata = { title: "Corregir comida — FitFood" };

export default async function PaginaComida({ params }: PageProps<"/comida/[id]">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const [comida, alimentos] = await Promise.all([
    obtenerComida(usuario.id, id),
    listarAlimentos(),
  ]);

  // Puede no existir porque se borró, o porque es de otra persona: el RLS no
  // distingue una cosa de la otra, y está bien que no lo haga.
  if (!comida) notFound();

  return <EditarComida comida={comida} alimentos={alimentos} />;
}
