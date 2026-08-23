"use client";

import { useState } from "react";
import { clienteNavegador } from "@/lib/supabase/cliente-navegador";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "enviando" }
  | { tipo: "enviado"; email: string }
  | { tipo: "error"; mensaje: string };

export function FormularioLogin({ destino }: { destino: string }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado({ tipo: "enviando" });

    try {
      const supabase = clienteNavegador();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // El destino viaja en la URL de callback para volver a donde iba.
          emailRedirectTo: `${window.location.origin}/auth/callback?siguiente=${encodeURIComponent(destino)}`,
        },
      });
      if (error) throw error;
      setEstado({ tipo: "enviado", email });
    } catch (err) {
      setEstado({
        tipo: "error",
        mensaje:
          err instanceof Error
            ? err.message
            : "No se pudo enviar el enlace. Intentá de nuevo.",
      });
    }
  }

  if (estado.tipo === "enviado") {
    return (
      <div className="mt-8 rounded-xl border border-hairline bg-good-bg p-4">
        <p className="text-sm font-medium text-good">Enlace enviado</p>
        <p className="mt-1.5 text-sm text-ink-2">
          Revisá <span className="font-medium">{estado.email}</span> y abrí el
          enlace desde este mismo teléfono. Vence en una hora.
        </p>
        <button
          type="button"
          onClick={() => setEstado({ tipo: "inicial" })}
          className="mt-3 text-sm text-accent underline underline-offset-4"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  const enviando = estado.tipo === "enviando";

  return (
    <form onSubmit={enviar} className="mt-8">
      <label htmlFor="email" className="block text-sm font-medium text-ink-2">
        Tu correo
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vos@ejemplo.com"
        className="mt-1.5 w-full rounded-xl border border-hairline bg-surface px-3.5 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-accent"
      />

      <button
        type="submit"
        disabled={enviando || email.length === 0}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-base font-medium text-white transition-opacity disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </button>

      <p className="mt-3 text-xs text-muted">
        Sin contraseña: te llega un enlace que te deja adentro.
      </p>

      {estado.tipo === "error" && (
        <p role="alert" className="mt-4 text-sm text-bad">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}
