import { describe, expect, it } from "vitest";
import { costoUsd, PRECIOS } from "@/lib/guardrails/costos";
import {
  LIMITES,
  verificarCuota,
  type EstadoCuota,
} from "@/lib/guardrails/limites";

/** Una cuota con todo en cero: el caso en que sí se puede llamar. */
const LIBRE: EstadoCuota = {
  turnosDeLaSesion: 0,
  fotosDeLaSesion: 0,
  sesionesDeHoy: 0,
  gastoDelMesUsd: 0,
  topeMensualUsd: 10,
};

const TEXTO = { texto: "2 arepas con quesito", tieneFoto: false };

describe("cuándo se puede llamar a la API", () => {
  it("deja pasar una petición normal", () => {
    expect(verificarCuota(TEXTO, LIBRE)).toBeNull();
  });

  it("deja pasar una foto sin texto", () => {
    expect(verificarCuota({ texto: null, tieneFoto: true }, LIBRE)).toBeNull();
  });

  it("deja pasar foto y texto juntos", () => {
    expect(
      verificarCuota({ texto: "es quesito", tieneFoto: true }, LIBRE),
    ).toBeNull();
  });
});

describe("rechazos", () => {
  it("sin foto ni texto no hay nada que estimar", () => {
    expect(verificarCuota({ texto: "   ", tieneFoto: false }, LIBRE)?.motivo).toBe(
      "sin_contenido",
    );
  });

  it("corta los mensajes largos", () => {
    const largo = "a".repeat(LIMITES.caracteresPorMensaje + 1);
    expect(verificarCuota({ texto: largo, tieneFoto: false }, LIBRE)?.motivo).toBe(
      "mensaje_largo",
    );
  });

  it("acepta un mensaje justo en el límite", () => {
    const justo = "a".repeat(LIMITES.caracteresPorMensaje);
    expect(verificarCuota({ texto: justo, tieneFoto: false }, LIBRE)).toBeNull();
  });

  it("corta en el turno 7 de una sesión", () => {
    const enElLimite = { ...LIBRE, turnosDeLaSesion: LIMITES.turnosPorSesion };
    expect(verificarCuota(TEXTO, enElLimite)?.motivo).toBe("demasiados_turnos");

    const unoAntes = { ...LIBRE, turnosDeLaSesion: LIMITES.turnosPorSesion - 1 };
    expect(verificarCuota(TEXTO, unoAntes)).toBeNull();
  });

  it("una segunda foto en la misma sesión se rechaza", () => {
    const conFoto = { ...LIBRE, fotosDeLaSesion: 1 };
    expect(
      verificarCuota({ texto: null, tieneFoto: true }, conFoto)?.motivo,
    ).toBe("demasiadas_fotos");
  });

  it("pero seguir con texto en esa sesión sí se puede", () => {
    // Corregir por texto una foto ya mandada es el flujo normal.
    const conFoto = { ...LIBRE, fotosDeLaSesion: 1 };
    expect(verificarCuota(TEXTO, conFoto)).toBeNull();
  });

  it("corta en la sesión 21 del día", () => {
    const enElLimite = { ...LIBRE, sesionesDeHoy: LIMITES.sesionesPorDia };
    expect(verificarCuota(TEXTO, enElLimite)?.motivo).toBe(
      "demasiadas_sesiones",
    );
  });

  it("corta al alcanzar el tope de gasto", () => {
    const gastado = { ...LIBRE, gastoDelMesUsd: 10, topeMensualUsd: 10 };
    expect(verificarCuota(TEXTO, gastado)?.motivo).toBe("tope_de_gasto");
  });

  it("cada rechazo dice qué se puede hacer igual", () => {
    const agotado = {
      ...LIBRE,
      sesionesDeHoy: LIMITES.sesionesPorDia,
    };
    const rechazo = verificarCuota(TEXTO, agotado);
    // Que la app siga siendo usable sin IA es el punto de todo esto.
    expect(rechazo?.mensaje).toMatch(/manual/i);
  });

  it("el orden pone primero lo accionable", () => {
    // Petición vacía Y cuota agotada: se avisa lo de la petición, que es lo
    // que la persona puede arreglar ahora mismo.
    const agotado = { ...LIBRE, sesionesDeHoy: 999, gastoDelMesUsd: 999 };
    expect(
      verificarCuota({ texto: "", tieneFoto: false }, agotado)?.motivo,
    ).toBe("sin_contenido");
  });
});

describe("costo de un turno", () => {
  it("cuenta entrada y salida a los precios publicados", () => {
    // 10k de entrada + 1k de salida.
    expect(costoUsd({ entrada: 10_000, salida: 1_000 })).toBeCloseTo(
      (10_000 * PRECIOS.entrada + 1_000 * PRECIOS.salida) / 1_000_000,
      6,
    );
  });

  it("el caché abarata la entrada diez veces", () => {
    const sinCache = costoUsd({ entrada: 10_000, salida: 500 });
    const conCache = costoUsd({
      entrada: 0,
      entradaCacheada: 10_000,
      salida: 500,
    });
    expect(conCache).toBeLessThan(sinCache);
    // Es la razón por la que la tabla de alimentos va en el prefijo cacheado.
    expect(sinCache - conCache).toBeCloseTo(
      (10_000 * (PRECIOS.entrada - PRECIOS.entradaCacheada)) / 1_000_000,
      6,
    );
  });

  it("un turno típico cuesta centavos, no dólares", () => {
    // Tabla cacheada (~8k) + foto (~1.6k) + respuesta (~700).
    const tipico = costoUsd({
      entrada: 1_600,
      entradaCacheada: 8_000,
      salida: 700,
    });
    expect(tipico).toBeLessThan(0.05);
    expect(tipico).toBeGreaterThan(0);
  });

  it("cero tokens cuesta cero", () => {
    expect(costoUsd({ entrada: 0, salida: 0 })).toBe(0);
  });

  it("no redondea a cero un turno barato", () => {
    // Si se redondeara a centavos, cientos de turnos baratos sumarían $0.
    expect(costoUsd({ entrada: 100, salida: 10 })).toBeGreaterThan(0);
  });
});
