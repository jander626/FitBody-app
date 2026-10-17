import Link from "next/link";
import { TarjetaConsejo } from "@/components/tarjeta-consejo";
import { TituloSeccion } from "@/components/ui";
import { obtenerConsejos } from "@/lib/datos/consejos";

/**
 * El consejo más urgente de la semana.
 *
 * Es un componente aparte, y asíncrono, a propósito: calcular los consejos
 * lee varios días de comidas y de métricas, y es lo más lento de Hoy. Dentro
 * de un `<Suspense>` el resto de la pantalla —el arco, las comidas— llega
 * primero y esto aparece cuando está listo, en vez de que todo espere.
 */
export async function ConsejoDelDia({ usuarioId }: { usuarioId: string }) {
  const { consejos } = await obtenerConsejos(usuarioId);
  const consejo = consejos[0];
  if (!consejo) return null;

  return (
    <div className="entra">
      {/* Solo el más urgente. Los demás están en /consejos: una lista larga en
          la pantalla que se abre cuatro veces al día deja de leerse a los tres
          días. */}
      <TituloSeccion>Lo que dicen tus datos</TituloSeccion>
      <TarjetaConsejo consejo={consejo} />
      <Link href="/consejos" className="mt-2 block py-2 text-center text-sm text-muted">
        Ver todos los consejos
      </Link>
    </div>
  );
}
