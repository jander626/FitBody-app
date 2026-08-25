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
      {/*
        El hueco de abajo tiene que contar el área segura, no solo el alto de
        la barra. En un iPhone con indicador de inicio la barra mide unos 98 px
        y un pb-20 fijo (80) deja lo último de cada pantalla tapado: el botón
        de estimar quedaba debajo y no había forma de llegarle.
      */}
      <div
        className="safe-top flex-1"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
      <NavegacionInferior />
    </div>
  );
}
