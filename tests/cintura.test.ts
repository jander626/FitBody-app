/**
 * Tests de la lectura de cintura.
 *
 * Acá lo que se prueba no es aritmética —restar dos números no necesita
 * tests— sino cuándo la app tiene derecho a decir algo. Un consejo salido de
 * ruido de medición es peor que no decir nada: lleva a recortar calorías
 * porque la cinta quedó dos dedos más arriba.
 */
import { describe, expect, it } from "vitest";
import {
  DIAS_MINIMOS,
  RUIDO_CINTURA_CM,
  leerComposicion,
  type MedidaCintura,
} from "@/lib/nutrition/cintura";
import { mediaMovil7d } from "@/lib/nutrition";

/** Pesos diarios de `dias` días terminando en `hasta`, bajando `porDia`. */
function pesos(hasta: string, dias: number, desde: number, porDia: number) {
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  return Array.from({ length: dias }, (_, i) => ({
    fecha: new Date(fin - (dias - 1 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10),
    pesoKg: Number((desde + i * porDia).toFixed(2)),
  }));
}

const NADA: MedidaCintura[] = [];

describe("cuando no hay con qué comparar", () => {
  it("sin ninguna medida explica cómo medir", () => {
    const r = leerComposicion(NADA);
    expect(r.lectura).toBe("sin_medidas");
    // El "cómo" importa tanto como el "qué": mal medida, la serie no sirve.
    expect(r.detalle).toContain("ombligo");
    expect(r.deltaCinturaCm).toBeNull();
  });

  it("con una sola la trata como punto de partida", () => {
    const r = leerComposicion([{ fecha: "2026-08-30", cinturaCm: 94 }]);
    expect(r.lectura).toBe("primera");
    expect(r.titulo).toContain("94");
    expect(r.deltaCinturaCm).toBeNull();
  });

  it("con dos medidas muy seguidas se abstiene", () => {
    // Una semana no alcanza para que la grasa se mueva de forma medible.
    const r = leerComposicion([
      { fecha: "2026-08-23", cinturaCm: 94 },
      { fecha: "2026-08-30", cinturaCm: 92 },
    ]);
    expect(r.lectura).toBe("muy_pronto");
    expect(r.dias).toBe(7);
    // Aunque la diferencia sea grande, no se reporta como cambio.
    expect(r.deltaCinturaCm).toBeNull();
  });

  it("justo en el mínimo de días ya habla", () => {
    const r = leerComposicion([
      { fecha: "2026-08-16", cinturaCm: 94 },
      { fecha: "2026-08-30", cinturaCm: 92 },
    ]);
    expect(r.dias).toBe(DIAS_MINIMOS);
    expect(r.lectura).not.toBe("muy_pronto");
  });
});

describe("el ruido de la cinta", () => {
  it("medio centímetro en un mes no es nada", () => {
    const r = leerComposicion([
      { fecha: "2026-08-02", cinturaCm: 94 },
      { fecha: "2026-08-30", cinturaCm: 93.5 },
    ]);
    expect(r.lectura).toBe("estable");
    expect(r.deltaCinturaCm).toBe(-0.5);
  });

  it("justo en el umbral sí cuenta", () => {
    const r = leerComposicion([
      { fecha: "2026-08-02", cinturaCm: 94 },
      { fecha: "2026-08-30", cinturaCm: 94 - RUIDO_CINTURA_CM },
    ]);
    expect(r.lectura).not.toBe("estable");
  });
});

describe("cruzando cintura y peso", () => {
  const previa = "2026-08-02";
  const ultima = "2026-08-30";
  const dosMedidas = (antes: number, ahora: number): MedidaCintura[] => [
    { fecha: previa, cinturaCm: antes },
    { fecha: ultima, cinturaCm: ahora },
  ];

  it("las dos bajan: es grasa", () => {
    const serie = mediaMovil7d(pesos(ultima, 35, 82, -0.06));
    const r = leerComposicion(dosMedidas(96, 93), serie);
    expect(r.lectura).toBe("grasa_bajando");
    expect(r.deltaCinturaCm).toBe(-3);
    expect(r.deltaPesoKg).toBeLessThan(0);
  });

  it("cintura baja con peso quieto: recomposición", () => {
    // El caso que justifica medir. Sin la cinta esto se lee como estancamiento
    // y lleva a recortar calorías que no había que recortar.
    const serie = mediaMovil7d(pesos(ultima, 35, 80, 0));
    const r = leerComposicion(dosMedidas(96, 93), serie);
    expect(r.lectura).toBe("recomposicion");
    expect(r.detalle).toContain("sin necesidad");
  });

  it("peso baja con cintura quieta: puede no ser grasa", () => {
    const serie = mediaMovil7d(pesos(ultima, 35, 84, -0.08));
    const r = leerComposicion(dosMedidas(94, 93.8), serie);
    expect(r.lectura).toBe("peso_sin_cintura");
    expect(r.detalle).toContain("proteína");
  });

  it("las dos suben: el déficit no está siendo real", () => {
    const serie = mediaMovil7d(pesos(ultima, 35, 79, 0.05));
    const r = leerComposicion(dosMedidas(93, 95), serie);
    expect(r.lectura).toBe("grasa_subiendo");
  });

  it("sube el peso con la cintura quieta: masa magra", () => {
    const serie = mediaMovil7d(pesos(ultima, 35, 79, 0.05));
    const r = leerComposicion(dosMedidas(93, 93.2), serie);
    expect(r.lectura).toBe("magra_subiendo");
  });

  it("las dos quietas: sin señal", () => {
    const serie = mediaMovil7d(pesos(ultima, 35, 80, 0));
    const r = leerComposicion(dosMedidas(93, 93.3), serie);
    expect(r.lectura).toBe("estable");
  });

  it("cintura sube y peso baja: se sospecha de la medición, no del cuerpo", () => {
    // Fisiológicamente casi imposible en un mes. Decir "estás ganando grasa"
    // acá sería inventar; lo honesto es dudar de la cinta.
    const serie = mediaMovil7d(pesos(ultima, 35, 84, -0.08));
    const r = leerComposicion(dosMedidas(93, 95), serie);
    expect(r.lectura).toBe("discordante");
    expect(r.detalle).toContain("Volvé a medir");
  });
});

describe("sin tendencia de peso", () => {
  it("informa la cintura sola sin inventar el resto", () => {
    const r = leerComposicion([
      { fecha: "2026-08-02", cinturaCm: 96 },
      { fecha: "2026-08-30", cinturaCm: 93 },
    ]);
    expect(r.lectura).toBe("grasa_bajando");
    expect(r.deltaPesoKg).toBeNull();
    expect(r.detalle).toContain("Falta tendencia de peso");
  });

  it("tampoco inventa si los pesos son muy pocos para la media móvil", () => {
    // Tres días no producen media móvil de 7: no hay tendencia que cruzar.
    const serie = mediaMovil7d(pesos("2026-08-30", 3, 80, -0.1));
    const r = leerComposicion(
      [
        { fecha: "2026-08-02", cinturaCm: 96 },
        { fecha: "2026-08-30", cinturaCm: 93 },
      ],
      serie,
    );
    expect(r.deltaPesoKg).toBeNull();
  });
});

describe("elegir contra qué medida comparar", () => {
  it("usa la más vieja dentro de la ventana, no la de hace meses", () => {
    const r = leerComposicion([
      { fecha: "2026-05-01", cinturaCm: 104 }, // fuera de ventana
      { fecha: "2026-08-09", cinturaCm: 95 },
      { fecha: "2026-08-30", cinturaCm: 93 },
    ]);
    // Contra mayo diría −11 cm, que es verdad pero no es la pregunta de hoy.
    expect(r.deltaCinturaCm).toBe(-2);
    expect(r.dias).toBe(21);
  });

  it("si todas son viejas usa la más vieja que haya", () => {
    const r = leerComposicion([
      { fecha: "2026-05-01", cinturaCm: 104 },
      { fecha: "2026-08-30", cinturaCm: 93 },
    ]);
    expect(r.deltaCinturaCm).toBe(-11);
  });

  it("no le importa el orden en que lleguen", () => {
    const desordenadas: MedidaCintura[] = [
      { fecha: "2026-08-30", cinturaCm: 93 },
      { fecha: "2026-08-02", cinturaCm: 96 },
    ];
    expect(leerComposicion(desordenadas).deltaCinturaCm).toBe(-3);
  });
});
