"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { calcularPlan } from "@/lib/nutrition";
import { clienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Validación en el servidor. El formulario también valida, pero eso es
 * comodidad para quien escribe; esto es lo que decide qué entra a la base.
 */
const Esquema = z.object({
  edad: z.coerce.number().int().min(10).max(120),
  sexo: z.enum(["hombre", "mujer"]),
  estaturaCm: z.coerce.number().min(100).max(250),
  pesoKg: z.coerce.number().min(20).max(400),
  factorActividad: z.coerce.number().min(1.0).max(2.5),
  objetivo: z.enum(["perder_grasa", "mantener", "ganar_musculo"]),
  deficitPct: z.coerce.number().min(-30).max(40),
  pesoMetaKg: z.coerce.number().min(20).max(400).optional(),
});

export type ResultadoGuardar =
  | { ok: true; kcal: number }
  | { ok: false; error: string };

export async function guardarPerfil(
  _previo: ResultadoGuardar | null,
  datos: FormData,
): Promise<ResultadoGuardar> {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "La sesión venció. Entrá de nuevo." };

  const crudo = Object.fromEntries(datos);
  const analisis = Esquema.safeParse({
    ...crudo,
    pesoMetaKg: crudo.pesoMetaKg === "" ? undefined : crudo.pesoMetaKg,
  });

  if (!analisis.success) {
    const primero = analisis.error.issues[0];
    return {
      ok: false,
      error: `Revisá el campo "${primero.path.join(".")}": ${primero.message}`,
    };
  }

  const v = analisis.data;

  const plan = calcularPlan(
    {
      sexo: v.sexo,
      edad: v.edad,
      estaturaCm: v.estaturaCm,
      pesoKg: v.pesoKg,
    },
    v.factorActividad,
    v.objetivo,
    v.deficitPct,
  );

  const { error: errPerfil } = await supabase
    .from("profiles")
    .update({
      edad: v.edad,
      sexo: v.sexo,
      estatura_cm: v.estaturaCm,
    })
    .eq("id", user.id);
  if (errPerfil) return { ok: false, error: errPerfil.message };

  // El peso de hoy: si ya te pesaste, esto lo corrige en vez de duplicarlo.
  const hoy = new Date().toISOString().slice(0, 10);
  const { error: errPeso } = await supabase.from("weight_logs").upsert(
    {
      user_id: user.id,
      fecha: hoy,
      peso_kg: v.pesoKg,
    },
    { onConflict: "user_id,fecha" },
  );
  if (errPeso) return { ok: false, error: errPeso.message };

  // El objetivo se versiona: se desactiva el anterior y se crea uno nuevo, así
  // queda registrado con qué plan se vivió cada tramo.
  const { error: errDesactivar } = await supabase
    .from("user_goals")
    .update({ activo: false })
    .eq("user_id", user.id)
    .eq("activo", true);
  if (errDesactivar) return { ok: false, error: errDesactivar.message };

  const { error: errObjetivo } = await supabase.from("user_goals").insert({
    user_id: user.id,
    objetivo: v.objetivo,
    peso_meta_kg: v.pesoMetaKg ?? null,
    factor_actividad: v.factorActividad,
    deficit_pct: v.deficitPct,
    kcal: plan.kcalObjetivo,
    proteina_g: plan.proteinaG,
    carbs_g: plan.carbsG,
    grasa_g: plan.grasaG,
    activo: true,
    motivo: "Editado desde el perfil",
  });
  if (errObjetivo) return { ok: false, error: errObjetivo.message };

  revalidatePath("/perfil");
  revalidatePath("/hoy");

  return { ok: true, kcal: plan.kcalObjetivo };
}
