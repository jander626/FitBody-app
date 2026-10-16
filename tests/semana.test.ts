import { describe, expect, it } from "vitest";
import { semanaDe } from "@/lib/semana";

describe("semanaDe", () => {
  it("va de lunes a domingo", () => {
    // Jueves 15 de octubre de 2026
    expect(semanaDe("2026-10-15")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("un lunes abre su propia semana y un domingo la cierra", () => {
    expect(semanaDe("2026-10-12")[0]).toBe("2026-10-12");
    expect(semanaDe("2026-10-18")[6]).toBe("2026-10-18");
    expect(semanaDe("2026-10-18")[0]).toBe("2026-10-12");
  });

  it("cruza el fin de mes y de año", () => {
    expect(semanaDe("2026-12-31")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});
