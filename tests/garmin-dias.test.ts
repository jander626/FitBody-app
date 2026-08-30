/**
 * Tests de las fechas de la carga manual.
 *
 * Es aritmética de calendario, que es donde se cuelan los errores caros: un
 * día corrido escribe las calorías del sábado en el domingo, y el déficit de
 * los dos días sale mal sin que nada avise.
 */
import { describe, expect, it } from "vitest";
import { nombreDia, ultimosDias } from "@/lib/garmin/dias";

describe("ultimosDias", () => {
  it("termina en la fecha pedida y va de vieja a nueva", () => {
    expect(ultimosDias("2026-08-30", 8)).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
  });

  it("cruza el cambio de mes sin saltarse nada", () => {
    expect(ultimosDias("2026-09-02", 4)).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("cruza el cambio de año", () => {
    expect(ultimosDias("2027-01-01", 3)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("cuenta bien un 29 de febrero bisiesto", () => {
    expect(ultimosDias("2028-03-01", 3)).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("no se corre por horario de verano", () => {
    // El cálculo es en UTC a partir de una fecha ya resuelta. Si usara la hora
    // local del servidor, un día de cambio de hora saldría repetido o salteado.
    const dias = ultimosDias("2026-11-02", 5);
    expect(new Set(dias).size).toBe(5);
    expect(dias.at(-1)).toBe("2026-11-02");
  });

  it("con cero o una fecha inválida devuelve vacío, no lanza", () => {
    expect(ultimosDias("2026-08-30", 0)).toEqual([]);
    expect(ultimosDias("no-es-fecha", 5)).toEqual([]);
  });
});

describe("nombreDia", () => {
  it("acierta el día de la semana", () => {
    // 30 de agosto de 2026 es domingo, que es el día de la rutina semanal.
    expect(nombreDia("2026-08-30")).toBe("dom");
    expect(nombreDia("2026-08-31")).toBe("lun");
    expect(nombreDia("2026-08-29")).toBe("sáb");
  });

  it("con basura devuelve vacío en vez de lanzar", () => {
    expect(nombreDia("")).toBe("");
    expect(nombreDia("2026-13-45")).toBe("");
  });
});
