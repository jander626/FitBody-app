"use client";

import { useEffect } from "react";

/**
 * Qué se ve cuando algo falla dentro de la app.
 *
 * Sin este archivo, un error en cualquier pantalla —o en una acción de
 * servidor, como guardar el peso— deja la pantalla del navegador: fondo
 * blanco, "This page couldn't load", y ninguna forma de volver a la app.
 * Pasó de verdad al guardar un pesaje.
 *
 * Lo que hace falta acá es distinto de un mensaje bonito:
 *
 *  - **Decir si lo que se estaba guardando se guardó o no.** Es la primera
 *    pregunta de quien acaba de tocar "Guardar", y la que más angustia.
 *  - **Un botón que reintente** sin salir de la app ni perder la sesión.
 *  - **Una salida** a una pantalla que sí funciona.
 *
 * `reset()` vuelve a montar el árbol que falló. Si el error fue pasajero —una
 * conexión que se cortó a mitad— alcanza con eso.
 */
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Queda en la consola del navegador y en los logs de Vercel. El digest es
    // lo que permite encontrar este error concreto entre todos los del día.
    console.error("FitFood falló:", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="font-serif text-2xl text-ink">Algo se rompió</h1>

      <p className="text-sm text-ink-2">
        No fue culpa tuya. Si estabas guardando algo, puede que haya quedado
        guardado igual: probá recargar y fijate antes de volver a escribirlo.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-base font-medium text-white"
        >
          Reintentar
        </button>
        <a
          href="/hoy"
          className="flex-1 rounded-xl border border-hairline px-4 py-3 text-center text-base text-ink"
        >
          Ir a Hoy
        </a>
      </div>

      {error.digest && (
        <p className="text-xs text-muted">
          Si vuelve a pasar, este código ayuda a encontrarlo en los registros:{" "}
          <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </main>
  );
}
