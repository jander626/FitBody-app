"use server";

import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

/** Cierra la sesión y vuelve al login. */
export async function cerrarSesion() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
