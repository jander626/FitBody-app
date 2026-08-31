import "server-only";

import { cookies } from "next/headers";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";
import { COOKIE_ZONA, fechaEnZona, zonaSegura } from "@/lib/zona";
import type { Totales } from "@/lib/registro/tipos";
import { urlsDeFotos } from "./fotos";

export interface ItemDiario {
  id: string;
  /**
   * El alimento de la tabla, cuando quedó enlazado.
   *
   * Hace falta para editar: con el enlace, mover la porción recalcula los
   * macros desde la tabla; sin él, solo se pueden escalar los números que
   * estimó el modelo.
   */
  foodId: string | null;
  alimento: string;
  porcionG: number | null;
  porcionMl: number | null;
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
  notaCorreccion: string | null;
  nota: string | null;
}

export interface ComidaDiario {
  id: string;
  momento: string;
  hora: string | null;
  confianza: "alta" | "media" | "baja" | null;
  origen: string;
  corregido: boolean;
  nota: string | null;
  /**
   * URL firmada de la foto, cuando la comida se registró con una.
   *
   * Vence en una hora: es una URL prestada, no una dirección fija. Null
   * también cuando la foto existe pero no se pudo firmar — la comida y sus
   * números valen igual sin la imagen.
   */
  fotoUrl: string | null;
  items: ItemDiario[];
  subtotal: Totales;
}

export type { Totales } from "@/lib/registro/tipos";

export interface Dia {
  fecha: string;
  comidas: ComidaDiario[];
  totales: Totales;
  objetivo: Totales | null;
}

const CERO: Totales = { kcal: 0, proteinaG: 0, carbsG: 0, grasaG: 0 };

function sumar(items: { kcal: number; proteinaG: number; carbsG: number; grasaG: number }[]): Totales {
  return items.reduce<Totales>(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      proteinaG: acc.proteinaG + i.proteinaG,
      carbsG: acc.carbsG + i.carbsG,
      grasaG: acc.grasaG + i.grasaG,
    }),
    { ...CERO },
  );
}

/** Orden en que se muestran las comidas del día. */
const ORDEN_MOMENTO = [
  "desayuno",
  "snack",
  "almuerzo",
  "postre",
  "bebida",
  "cena",
  "otro",
];

/** Lee un día completo del diario con su objetivo activo. */
export async function obtenerDia(userId: string, fecha: string): Promise<Dia> {
  const supabase = await clienteServidor();

  const [comidasRes, objetivoRes] = await Promise.all([
    supabase
      .from("meal_logs")
      .select(
        `id, momento, hora, confianza, origen, corregido, nota,
         scan_sessions ( foto_path ),
         meal_log_items (
           id, food_id, alimento, porcion_g, porcion_ml, kcal, proteina_g,
           carbs_g, grasa_g, nota_correccion, nota, orden
         )`,
      )
      .eq("user_id", userId)
      .eq("fecha", fecha)
      .order("creado_en", { ascending: true }),
    supabase
      .from("user_goals")
      .select("kcal, proteina_g, carbs_g, grasa_g")
      .eq("user_id", userId)
      .eq("activo", true)
      .maybeSingle(),
  ]);

  // Las fotos se firman todas de una: son cuatro o cinco por día, y firmarlas
  // de a una serían cinco viajes más para pintar la misma pantalla.
  const fotos = await urlsDeFotos(
    (comidasRes.data ?? []).map((c) => c.scan_sessions?.foto_path),
  );

  const comidas: ComidaDiario[] = (comidasRes.data ?? [])
    .map((c) => {
      const items: ItemDiario[] = [...(c.meal_log_items ?? [])]
        .sort((a, b) => a.orden - b.orden)
        .map((i) => ({
          id: i.id,
          foodId: i.food_id,
          alimento: i.alimento,
          porcionG: i.porcion_g,
          porcionMl: i.porcion_ml,
          kcal: i.kcal,
          proteinaG: i.proteina_g,
          carbsG: i.carbs_g,
          grasaG: i.grasa_g,
          notaCorreccion: i.nota_correccion,
          nota: i.nota,
        }));

      return {
        id: c.id,
        momento: c.momento,
        hora: c.hora,
        confianza: c.confianza as ComidaDiario["confianza"],
        origen: c.origen,
        corregido: c.corregido,
        nota: c.nota,
        fotoUrl: fotos.get(c.scan_sessions?.foto_path ?? "") ?? null,
        items,
        // El subtotal se calcula desde los ítems en vez de guardarse: un
        // subtotal almacenado se desincroniza en cuanto se edita un ítem.
        subtotal: sumar(items),
      };
    })
    .sort(
      (a, b) =>
        ORDEN_MOMENTO.indexOf(a.momento) - ORDEN_MOMENTO.indexOf(b.momento),
    );

  const objetivo = objetivoRes.data
    ? {
        kcal: objetivoRes.data.kcal,
        proteinaG: objetivoRes.data.proteina_g,
        carbsG: objetivoRes.data.carbs_g,
        grasaG: objetivoRes.data.grasa_g,
      }
    : null;

  return {
    fecha,
    comidas,
    totales: sumar(comidas.flatMap((c) => c.items)),
    objetivo,
  };
}

/** Una comida sola, para editarla. Trae su fecha, que la lista no necesita. */
export interface ComidaSuelta extends ComidaDiario {
  fecha: string;
}

/**
 * Busca una comida por su id.
 *
 * El filtro por `user_id` es redundante con el RLS, y va igual: si algún día
 * alguien llama a esto con la clave de servicio, el RLS no lo frena y este
 * filtro sí.
 */
export async function obtenerComida(
  userId: string,
  comidaId: string,
): Promise<ComidaSuelta | null> {
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("meal_logs")
    .select(
      `id, fecha, momento, hora, confianza, origen, corregido, nota,
       scan_sessions ( foto_path ),
       meal_log_items (
         id, food_id, alimento, porcion_g, porcion_ml, kcal, proteina_g,
         carbs_g, grasa_g, nota_correccion, nota, orden
       )`,
    )
    .eq("id", comidaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  const fotos = await urlsDeFotos([data.scan_sessions?.foto_path]);

  const items: ItemDiario[] = [...(data.meal_log_items ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((i) => ({
      id: i.id,
      foodId: i.food_id,
      alimento: i.alimento,
      porcionG: i.porcion_g,
      porcionMl: i.porcion_ml,
      kcal: i.kcal,
      proteinaG: i.proteina_g,
      carbsG: i.carbs_g,
      grasaG: i.grasa_g,
      notaCorreccion: i.nota_correccion,
      nota: i.nota,
    }));

  return {
    id: data.id,
    fecha: data.fecha,
    momento: data.momento,
    hora: data.hora,
    confianza: data.confianza as ComidaDiario["confianza"],
    origen: data.origen,
    corregido: data.corregido,
    nota: data.nota,
    fotoUrl: fotos.get(data.scan_sessions?.foto_path ?? "") ?? null,
    items,
    subtotal: sumar(items),
  };
}

/**
 * Qué día es hoy para quien está mirando, en AAAA-MM-DD.
 *
 * Es asíncrona porque lee la cookie con la zona del navegador. Antes devolvía
 * la fecha en UTC, y eso ponía las cenas colombianas en el día siguiente: a
 * las 7 de la tarde el servidor ya había cambiado de día.
 */
export async function fechaDeHoy(): Promise<string> {
  const galletas = await cookies();
  const zona = zonaSegura(galletas.get(COOKIE_ZONA)?.value, process.env);
  return fechaEnZona(zona);
}
