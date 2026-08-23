import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos-db";
import {
  verificarCuota,
  type Entrada,
  type EstadoCuota,
  type Rechazo,
} from "./limites";

/** Tope mensual en dólares. Configurable por entorno. */
export function topeMensualUsd(): number {
  const bruto = Number(process.env.FITFOOD_TOPE_MENSUAL_USD);
  return Number.isFinite(bruto) && bruto > 0 ? bruto : 10;
}

function inicioDelDiaUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function inicioDelMesUTC(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Lee los contadores de Postgres y decide.
 *
 * Los contadores se leen del servidor, nunca del cliente: un límite que el
 * navegador puede cambiar no es un límite.
 */
export async function verificarAntesDeLlamar(
  db: SupabaseClient<Database>,
  userId: string,
  entrada: Entrada,
  sessionId: string | null,
): Promise<Rechazo | null> {
  const [sesionRes, sesionesHoyRes, gastoRes] = await Promise.all([
    sessionId
      ? db
          .from("scan_sessions")
          .select("turnos, foto_path")
          .eq("id", sessionId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("scan_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("creado_en", inicioDelDiaUTC()),
    db
      .from("scan_turns")
      .select("costo_usd")
      .eq("user_id", userId)
      .gte("creado_en", inicioDelMesUTC()),
  ]);

  const estado: EstadoCuota = {
    turnosDeLaSesion: sesionRes.data?.turnos ?? 0,
    fotosDeLaSesion: sesionRes.data?.foto_path ? 1 : 0,
    // El cupo de sesiones solo aplica al abrir una nueva. Seguir una
    // conversación ya empezada no consume otra sesión, así que no puede
    // quedar bloqueada a la mitad por ese límite: para eso está el de turnos.
    sesionesDeHoy: sessionId ? 0 : (sesionesHoyRes.count ?? 0),
    gastoDelMesUsd: (gastoRes.data ?? []).reduce(
      (total, t) => total + t.costo_usd,
      0,
    ),
    topeMensualUsd: topeMensualUsd(),
  };

  return verificarCuota(entrada, estado);
}
