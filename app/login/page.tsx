import { FormularioLogin } from "./formulario";

export const metadata = { title: "Entrar — FitFood" };

/** Los errores viajan como código en la URL; el texto vive acá. */
const ERRORES: Record<string, string> = {
  sin_codigo: "El enlace venía incompleto. Pedí uno nuevo.",
  enlace_invalido:
    "Ese enlace ya se usó o venció. Pedí uno nuevo — duran una hora.",
};

export default async function Login(props: PageProps<"/login">) {
  const { siguiente, error } = await props.searchParams;
  const destino = typeof siguiente === "string" ? siguiente : "/hoy";
  const mensajeError =
    typeof error === "string" ? ERRORES[error] : undefined;

  const faltaConfig =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-serif text-3xl text-ink">FitFood</h1>
      <p className="mt-2 text-sm text-muted">
        Registro de calorías y macros por foto o por texto.
      </p>

      {faltaConfig ? (
        <div className="mt-8 rounded-xl border border-hairline bg-warn-bg p-4 text-sm text-warn">
          <p className="font-medium">Falta configurar Supabase.</p>
          <p className="mt-1.5 text-ink-2">
            Copiá <code className="font-mono text-xs">.env.example</code> a{" "}
            <code className="font-mono text-xs">.env.local</code> y llená{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code className="font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
            . El README tiene los pasos.
          </p>
        </div>
      ) : (
        <>
          {mensajeError && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-hairline bg-bad-bg px-4 py-3 text-sm text-bad"
            >
              {mensajeError}
            </p>
          )}
          <FormularioLogin destino={destino} />
        </>
      )}
    </main>
  );
}
