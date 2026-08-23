export const metadata = { title: "Sin conexión — FitFood" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-serif text-2xl text-ink">Sin conexión</h1>
      <p className="text-sm text-muted">
        No hay red en este momento. Lo que ya guardaste está a salvo en el
        servidor; en cuanto vuelva la señal, esta pantalla se actualiza sola.
      </p>
    </main>
  );
}
