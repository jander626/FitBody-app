import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/cliente-servidor";
import { NavegacionInferior } from "./navegacion";

/**
 * Marco de las pantallas con sesión.
 *
 * proxy.ts ya redirige a /login sin sesión; esta comprobación es el segundo
 * cerrojo. Si algún día un cambio en el matcher deja una ruta descubierta, acá
 * no se filtra nada.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* pb-20 deja lugar para la barra fija de abajo. */}
      <div className="safe-top flex-1 pb-20">{children}</div>
      <NavegacionInferior />
    </div>
  );
}
