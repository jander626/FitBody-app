import { z } from "zod";

/**
 * Lo que devuelve el modelo en cada turno.
 *
 * Una sola estructura para todo: siempre trae su mejor estimación **y**, si
 * hace falta, las preguntas. Nunca se queda esperando — la tarjeta editable
 * aparece de una y las preguntas son sugerencias para refinar.
 */
export const ItemEstimadoSchema = z.object({
  /**
   * Slug de la tabla de alimentos cuando el modelo reconoce uno de los
   * conocidos. Es lo que permite que los macros se recalculen desde la tabla
   * en vez de quedarse con la estimación.
   */
  slug: z
    .string()
    .nullable()
    .describe(
      "Slug exacto de la lista de alimentos conocidos, o null si no es ninguno de esos",
    ),
  alimento: z
    .string()
    .describe("Nombre del alimento como lo diría la persona, en español"),
  porcion_g: z
    .number()
    .nullable()
    .describe("Gramos estimados. null si la cantidad va en el nombre o no aplica"),
  porcion_ml: z
    .number()
    .nullable()
    .describe("Mililitros estimados, solo para líquidos. null si no aplica"),
  kcal: z.number().describe("Calorías estimadas de esta porción"),
  proteina_g: z.number(),
  carbs_g: z.number(),
  grasa_g: z.number(),
});

export const RespuestaSchema = z.object({
  fuera_de_tema: z
    .boolean()
    .describe(
      "true si el mensaje no es sobre comida, nutrición, ejercicio o composición corporal",
    ),
  momento: z
    .enum(["desayuno", "almuerzo", "cena", "snack", "postre", "bebida", "otro"])
    .describe("Momento de la comida, deducido de lo que se ve o se cuenta"),
  items: z.array(ItemEstimadoSchema).describe("Alimentos detectados"),
  confianza: z
    .enum(["alta", "media", "baja"])
    .describe(
      "alta: porciones claras y alimentos inequívocos. media: estimación razonable. baja: plato compartido, sin referencias de tamaño, o preparación desconocida",
    ),
  preguntas: z
    .array(z.string())
    .max(2)
    .describe(
      "Como máximo 2 preguntas concretas que cambiarían la estimación. Vacío si no hay dudas reales",
    ),
  nota: z
    .string()
    .describe("Una o dos frases explicando de dónde salió la estimación"),
});

export type ItemEstimado = z.infer<typeof ItemEstimadoSchema>;
export type Respuesta = z.infer<typeof RespuestaSchema>;
