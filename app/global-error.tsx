"use client";

/**
 * El último recurso: un error en el layout raíz.
 *
 * Reemplaza el documento entero, así que tiene que traer sus propios `html` y
 * `body` — a esta altura el layout ya falló y no hay nada alrededor. Por lo
 * mismo no puede usar los componentes ni las variables de color de la app: si
 * lo que falló fue justamente eso, la pantalla de error caería con él. Los
 * estilos van en línea y a mano, feos pero seguros.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "1rem",
          padding: "0 1.5rem",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>FitFood no pudo cargar</h1>
        <p style={{ fontSize: "0.875rem", margin: 0, color: "#555" }}>
          Falló algo de base. Lo que ya habías guardado sigue en el servidor.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#111",
            color: "#fff",
          }}
        >
          Reintentar
        </button>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#777", margin: 0 }}>
            Código: <code>{error.digest}</code>
          </p>
        )}
      </body>
    </html>
  );
}
