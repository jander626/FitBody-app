/**
 * Cada navegación entre pantallas monta este envoltorio de nuevo, y eso es lo
 * que dispara la animación de entrada. (`layout.tsx` se conserva entre
 * pantallas; `template.tsx` no.)
 */
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="pagina">{children}</div>;
}
