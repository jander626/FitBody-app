"use server";

import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { guardarMetricas } from "@/lib/datos/metricas";
import type { DiaMetrica } from "@/lib/garmin/csv";

/**
 * Guarda los días que la pantalla ya leyó y mostró.
 *
 * El CSV se lee en el navegador a propósito: así se puede mostrar qué se
 * entendió **antes** de guardar nada, que es la única forma de que alguien
 * confíe en una importación. Acá solo llegan los días ya interpretados.
 *
 * Igual se revalida todo lo que entra: lo que manda el cliente es una
 * petición, no una verdad, y estas filas terminan cambiando el gasto del día.
 */

const LIMITE_DIAS = 1000;

export async function guardarDiasGarmin(
  dias: DiaMetrica[],
): Promise<{ ok: true; guardados: number } | { ok: false; error: string }> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Sesión vencida. Entrá de nuevo." };

  if (!Array.isArray(dias) || dias.length === 0) {
    return { ok: false, error: "No hay días para guardar." };
  }
  if (dias.length > LIMITE_DIAS) {
    return {
      ok: false,
      error: `Son ${dias.length} días de una vez. Subí los informes por partes.`,
    };
  }

  const limpios: DiaMetrica[] = [];
  for (const dia of dias) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia?.fecha ?? "")) {
      return { ok: false, error: "Hay una fecha con un formato que no entiendo." };
    }
    limpios.push({
      fecha: dia.fecha,
      pasos: entero(dia.pasos, 0, 200_000),
      pasosObjetivo: entero(dia.pasosObjetivo, 0, 200_000),
      suenoHoras: decimal(dia.suenoHoras, 0, 24),
      suenoCalidad: texto(dia.suenoCalidad),
      suenoPuntuacion: entero(dia.suenoPuntuacion, 0, 100),
      fcReposo: entero(dia.fcReposo, 20, 200),
      bodyBattery: entero(dia.bodyBattery, 0, 100),
      kcalActivas: entero(dia.kcalActivas, 0, 10_000),
      kcalTotales: entero(dia.kcalTotales, 0, 20_000),
    });
  }

  try {
    const guardados = await guardarMetricas(user.id, limpios);
    revalidatePath("/garmin");
    revalidatePath("/historial");
    revalidatePath("/hoy");
    return { ok: true, guardados };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar.",
    };
  }
}

/**
 * Fuera de rango se descarta el valor, no la fila.
 *
 * Un body battery de 300 es un error de lectura de esa columna; el resto del
 * día puede estar perfecto. Rechazar el día entero perdería datos buenos por
 * una celda mala.
 */
function entero(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  return n >= min && n <= max ? n : undefined;
}

function decimal(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.round(v * 100) / 100;
  return n >= min && n <= max ? n : undefined;
}

function texto(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, 40);
  return t === "" ? undefined : t;
}
