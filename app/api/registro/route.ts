/**
 * El único endpoint que habla con Claude.
 *
 * Orden deliberado: primero los límites contra Postgres, después la llamada.
 * Si un límite rechaza, la API no se toca — que es el punto de tenerlos.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listarAlimentos } from "@/lib/datos/alimentos";
import { fechaDeHoy, obtenerDia } from "@/lib/datos/diario";
import { verificarAntesDeLlamar } from "@/lib/guardrails/verificar";
import { MODELO } from "@/lib/guardrails/costos";
import { LIMITES } from "@/lib/guardrails/limites";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { estimar, type TurnoPrevio } from "@/lib/vision/cliente";
import { normalizarEstimacion } from "@/lib/vision/normalizar";

const PeticionSchema = z.object({
  /** Null para empezar una sesión nueva. */
  sessionId: z.string().uuid().nullable().optional(),
  texto: z.string().max(LIMITES.caracteresPorMensaje * 2).nullable().optional(),
  /** JPEG/PNG/WebP en base64, sin el prefijo `data:`. */
  fotoBase64: z.string().max(8_000_000).nullable().optional(),
  fotoMediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).nullable().optional(),
  fotoPath: z.string().max(500).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sesión vencida. Entrá de nuevo." },
      { status: 401 },
    );
  }

  let cuerpo: z.infer<typeof PeticionSchema>;
  try {
    cuerpo = PeticionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const texto = cuerpo.texto?.trim() || null;
  const tieneFoto = Boolean(cuerpo.fotoBase64 && cuerpo.fotoMediaType);
  const sessionId = cuerpo.sessionId ?? null;

  // --- los límites, antes de gastar un centavo ---
  const rechazo = await verificarAntesDeLlamar(
    supabase,
    user.id,
    { texto, tieneFoto },
    sessionId,
  );

  if (rechazo) {
    return NextResponse.json(
      { error: rechazo.mensaje, motivo: rechazo.motivo },
      // 400 cuando es la petición; 429 cuando es la cuota.
      {
        status:
          rechazo.motivo === "sin_contenido" || rechazo.motivo === "mensaje_largo"
            ? 400
            : 429,
      },
    );
  }

  // --- contexto ---
  const hoy = fechaDeHoy();
  const [alimentos, dia] = await Promise.all([
    listarAlimentos(),
    obtenerDia(user.id, hoy),
  ]);

  // --- sesión y turnos previos ---
  let sesionId = sessionId;
  let previos: TurnoPrevio[] = [];
  let indiceTurno = 0;

  if (sesionId) {
    const { data: turnos } = await supabase
      .from("scan_turns")
      .select("indice, entrada_texto, respuesta_ia_json")
      .eq("session_id", sesionId)
      .eq("user_id", user.id)
      .order("indice", { ascending: true });

    previos = (turnos ?? []).map((t) => ({
      entradaTexto: t.entrada_texto,
      respuesta: t.respuesta_ia_json,
    }));
    indiceTurno = previos.length;
  } else {
    const { data: nueva, error } = await supabase
      .from("scan_sessions")
      .insert({
        user_id: user.id,
        foto_path: cuerpo.fotoPath ?? null,
        estado: "abierta",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "No se pudo abrir la sesión de registro." },
        { status: 500 },
      );
    }
    sesionId = nueva.id;
  }

  // --- la llamada ---
  let resultado;
  try {
    resultado = await estimar({
      alimentos,
      texto,
      fotoBase64: cuerpo.fotoBase64 ?? null,
      fotoMediaType: cuerpo.fotoMediaType ?? null,
      previos,
      objetivo: dia.objetivo,
      consumidoHoy: dia.totales,
      // Sale del diario real: lo que más registra es lo que más come.
      alimentosFrecuentes: frecuentes(dia),
    });
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : "Falló la estimación.";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  const { respuesta } = resultado;

  // --- se guarda el turno crudo antes de normalizar ---
  // Es la telemetría de precisión: sirve para medir cuánto acierta y para
  // armar el set de evaluación más adelante.
  await supabase.from("scan_turns").insert({
    session_id: sesionId,
    user_id: user.id,
    indice: indiceTurno,
    entrada_texto: texto,
    tuvo_foto: tieneFoto,
    respuesta_ia_json: respuesta,
    fuera_de_tema: respuesta.fuera_de_tema,
    latencia_ms: resultado.latenciaMs,
    tokens_in: resultado.tokensIn,
    tokens_cache_read: resultado.tokensCacheRead,
    tokens_out: resultado.tokensOut,
    costo_usd: resultado.costoUsd,
    modelo: MODELO,
  });

  await supabase
    .from("scan_sessions")
    .update({
      turnos: indiceTurno + 1,
      ...(respuesta.fuera_de_tema
        ? { fuera_de_tema_count: (previos.length > 0 ? 1 : 0) + 1 }
        : {}),
      ...(cuerpo.fotoPath ? { foto_path: cuerpo.fotoPath } : {}),
    })
    .eq("id", sesionId)
    .eq("user_id", user.id);

  if (respuesta.fuera_de_tema) {
    return NextResponse.json({
      sessionId: sesionId,
      fueraDeTema: true,
      mensaje:
        respuesta.nota ||
        "Solo puedo ayudarte con el registro de comidas y ejercicio.",
      turnosRestantes: LIMITES.turnosPorSesion - (indiceTurno + 1),
    });
  }

  const { items, enlazados } = normalizarEstimacion(respuesta.items, alimentos);

  return NextResponse.json({
    sessionId: sesionId,
    fueraDeTema: false,
    momento: respuesta.momento,
    confianza: respuesta.confianza,
    preguntas: respuesta.preguntas,
    nota: respuesta.nota,
    items,
    enlazados,
    turnosRestantes: LIMITES.turnosPorSesion - (indiceTurno + 1),
    costoUsd: resultado.costoUsd,
  });
}

/** Los alimentos que más aparecen en el diario reciente. */
function frecuentes(dia: Awaited<ReturnType<typeof obtenerDia>>): string[] {
  const cuenta = new Map<string, number>();
  for (const comida of dia.comidas) {
    for (const item of comida.items) {
      cuenta.set(item.alimento, (cuenta.get(item.alimento) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([nombre]) => nombre);
}
