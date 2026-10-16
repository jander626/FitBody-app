import { describe, expect, it } from "vitest";
import { haceDias, racha } from "@/lib/racha";

describe("racha", () => {
  it("cuenta los días seguidos hasta hoy", () => {
    expect(racha(["2026-10-13", "2026-10-14", "2026-10-15"], "2026-10-15")).toBe(3);
  });

  it("si hoy aún no hay registro, cuenta desde ayer sin romperla", () => {
    expect(racha(["2026-10-13", "2026-10-14"], "2026-10-15")).toBe(2);
  });

  it("se corta en el primer día sin registro", () => {
    expect(racha(["2026-10-10", "2026-10-13", "2026-10-14", "2026-10-15"], "2026-10-15")).toBe(3);
  });

  it("es cero si ni hoy ni ayer hay registro", () => {
    expect(racha(["2026-10-10", "2026-10-11"], "2026-10-15")).toBe(0);
    expect(racha([], "2026-10-15")).toBe(0);
  });

  it("cruza el fin de mes", () => {
    expect(racha(["2026-09-30", "2026-10-01"], "2026-10-01")).toBe(2);
  });
});

describe("haceDias", () => {
  it("resta días calendario", () => {
    expect(haceDias("2026-10-15", 30)).toBe("2026-09-15");
    expect(haceDias("2026-03-01", 1)).toBe("2026-02-28");
  });
});
