/**
 * Tests del borrador de registro.
 *
 * Lo que se protege acá no es tipeo: una estimación por foto cuesta una de las
 * veinte llamadas diarias al modelo. Perderla por cambiar de pestaña era el
 * bug; recuperar la equivocada sería el siguiente, así que las reglas de
 * cuándo *no* recuperar tienen tantos tests como las de cuándo sí.
 */
import { describe, expect, it } from "vitest";
import {
  empaquetar,
  interpretar,
  tieneAlgo,
  VIGENCIA_MS,
  type DatosBorrador,
  type Estimacion,
} from "@/lib/registro/borrador";

const HOY = "2026-08-26";
const AHORA = new Date("2026-08-26T18:00:00Z").getTime();

const ESTIMACION: Estimacion = {
  sessionId: "b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  momento: "almuerzo",
  confianza: "media",
  preguntas: ["¿El plato era compartido?"],
  nota: "Pollo a la plancha estimado en 150 g.",
  turnosRestantes: 4,
};

function borrador(cambios: Partial<DatosBorrador> = {}): DatosBorrador {
  return {
    fecha: HOY,
    texto: "",
    momento: "almuerzo",
    estimacion: ESTIMACION,
    items: [
      {
        foodId: "11111111-2222-4333-8444-555555555555",
        alimento: "Pechuga de pollo a la plancha",
        porcionG: 150,
        porcionMl: null,
        kcal: 248,
        proteinaG: 46.5,
        carbsG: 0,
        grasaG: 5.4,
        nota: null,
      },
    ],
    ...cambios,
  };
}

describe("ida y vuelta", () => {
  it("lo que se guarda vuelve igual", () => {
    const original = borrador();
    const recuperado = interpretar(empaquetar(original, AHORA), {
      fecha: HOY,
      ahora: AHORA,
    });
    expect(recuperado).toEqual(original);
  });

  it("conserva los números de los ítems sin redondear", () => {
    // Si el borrador redondeara al guardar, recuperar cambiaría las calorías
    // sin que nadie tocara nada.
    const original = borrador({
      items: [{ ...borrador().items[0], kcal: 248.7, proteinaG: 46.55 }],
    });
    const vuelto = interpretar(empaquetar(original, AHORA), {
      fecha: HOY,
      ahora: AHORA,
    });
    expect(vuelto?.items[0].kcal).toBe(248.7);
    expect(vuelto?.items[0].proteinaG).toBe(46.55);
  });

  it("un borrador de solo texto también se recupera", () => {
    // El caso de "escribí media descripción y me llamaron por teléfono".
    const original = borrador({ estimacion: null, items: [], texto: "2 arepas" });
    expect(
      interpretar(empaquetar(original, AHORA), { fecha: HOY, ahora: AHORA }),
    ).toEqual(original);
  });
});

describe("cuándo NO se recupera", () => {
  it("si es de otro día", () => {
    // Guardar usaría la fecha de la pantalla, no la del borrador: recuperar la
    // cena de ayer la escribiría en hoy, en silencio. Mejor perderlo.
    const ayer = empaquetar(borrador({ fecha: "2026-08-25" }), AHORA);
    expect(interpretar(ayer, { fecha: HOY, ahora: AHORA })).toBeNull();
  });

  it("si ya venció", () => {
    const viejo = empaquetar(borrador(), AHORA - VIGENCIA_MS - 1);
    expect(interpretar(viejo, { fecha: HOY, ahora: AHORA })).toBeNull();
  });

  it("justo en el borde de la vigencia todavía sirve", () => {
    const alFilo = empaquetar(borrador(), AHORA - VIGENCIA_MS);
    expect(interpretar(alFilo, { fecha: HOY, ahora: AHORA })).not.toBeNull();
  });

  it("si dice venir del futuro", () => {
    // Pasa si el reloj del teléfono se corrigió solo. No hay forma de saber
    // qué tan viejo es en realidad.
    const futuro = empaquetar(borrador(), AHORA + 60_000);
    expect(interpretar(futuro, { fecha: HOY, ahora: AHORA })).toBeNull();
  });

  it("si está vacío", () => {
    const vacio = empaquetar(
      borrador({ estimacion: null, items: [], texto: "   " }),
      AHORA,
    );
    expect(interpretar(vacio, { fecha: HOY, ahora: AHORA })).toBeNull();
  });

  it("si no hay nada guardado", () => {
    expect(interpretar(null, { fecha: HOY, ahora: AHORA })).toBeNull();
    expect(interpretar("", { fecha: HOY, ahora: AHORA })).toBeNull();
  });
});

describe("cuando lo guardado no se entiende", () => {
  const casos: [string, string][] = [
    ["no es JSON", "{esto no cierra"],
    ["es JSON pero no un borrador", '{"hola":"mundo"}'],
    ["es de una versión vieja", '{"v":0,"guardadoEn":0,"fecha":"2026-08-26"}'],
    ["es un arreglo", "[1,2,3]"],
    ["es null literal", "null"],
  ];

  it.each(casos)("%s → null, sin lanzar", (_, cadena) => {
    expect(() => interpretar(cadena, { fecha: HOY, ahora: AHORA })).not.toThrow();
    expect(interpretar(cadena, { fecha: HOY, ahora: AHORA })).toBeNull();
  });

  it("un ítem corrupto descarta el borrador entero", () => {
    // Recuperar los ítems buenos y callar los malos sería peor: el total
    // saldría distinto del que se estaba viendo, sin decir por qué.
    const roto = JSON.parse(empaquetar(borrador(), AHORA));
    roto.items[0].kcal = "muchas";
    expect(
      interpretar(JSON.stringify(roto), { fecha: HOY, ahora: AHORA }),
    ).toBeNull();
  });

  it("un momento que no existe también lo descarta", () => {
    const roto = JSON.parse(empaquetar(borrador(), AHORA));
    roto.momento = "onces";
    expect(
      interpretar(JSON.stringify(roto), { fecha: HOY, ahora: AHORA }),
    ).toBeNull();
  });
});

describe("tieneAlgo", () => {
  it("un formulario en blanco no vale la pena", () => {
    expect(
      tieneAlgo({ fecha: HOY, texto: "", momento: "cena", estimacion: null, items: [] }),
    ).toBe(false);
  });

  it("espacios en blanco tampoco", () => {
    expect(
      tieneAlgo({ fecha: HOY, texto: "\n  ", momento: "cena", estimacion: null, items: [] }),
    ).toBe(false);
  });

  it("una estimación sí, aunque no queden ítems", () => {
    // Se pueden borrar todos los ítems y seguir teniendo la sesión abierta con
    // turnos de ajuste disponibles. Eso vale.
    expect(
      tieneAlgo({
        fecha: HOY,
        texto: "",
        momento: "cena",
        estimacion: ESTIMACION,
        items: [],
      }),
    ).toBe(true);
  });
});
