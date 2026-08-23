import "server-only";

import { clienteServidor } from "@/lib/supabase/cliente-servidor";

export interface ItemDiario {
  id: string;
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
  items: ItemDiario[];
  subtotal: Totales;
}

export interface Totales {
  kcal: number;
  proteinaG: number;
  carbsG: number;
  grasaG: number;
}

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
         meal_log_items (
           id, alimento, porcion_g, porcion_ml, kcal, proteina_g, carbs_g,
           grasa_g, nota_correccion, nota, orden
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

  const comidas: ComidaDiario[] = (comidasRes.data ?? [])
    .map((c) => {
      const items: ItemDiario[] = [...(c.meal_log_items ?? [])]
        .sort((a, b) => a.orden - b.orden)
        .map((i) => ({
          id: i.id,
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

/** Fecha de hoy en AAAA-MM-DD, según la zona horaria del servidor. */
export function fechaDeHoy(): string {
  return new Date().toISOString().slice(0, 10);
}
