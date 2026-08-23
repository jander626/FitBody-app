import { describe, expect, it } from "vitest";
import { estadoMacro } from "@/components/medidor";

describe("estado de los macros", () => {
  it("la proteína se persigue hacia arriba: llegar es lograrlo", () => {
    expect(estadoMacro(160, 160, true)).toBe("logrado");
    expect(estadoMacro(180, 160, true)).toBe("logrado");
    // Pasarse de proteína no es un problema que valga la pena señalar.
    expect(estadoMacro(220, 160, true)).toBe("logrado");
  });

  it("quedarse corto de proteína es progreso, no fallo", () => {
    // El día no terminó: marcarlo en rojo a media tarde sería culpar sin razón.
    expect(estadoMacro(71, 160, true)).toBe("progreso");
    expect(estadoMacro(0, 160, true)).toBe("progreso");
  });

  it("los demás macros son techos", () => {
    expect(estadoMacro(100, 145, false)).toBe("progreso");
    expect(estadoMacro(145, 145, false)).toBe("progreso");
  });

  it("da un 5 % de margen antes de marcar exceso", () => {
    // Pasarse por 2 g de grasa no es "excederse".
    expect(estadoMacro(72, 70, false)).toBe("progreso");
    expect(estadoMacro(73.5, 70, false)).toBe("progreso"); // exactamente 105 %
    expect(estadoMacro(74, 70, false)).toBe("excedido");
  });

  it("sin objetivo no inventa un estado", () => {
    expect(estadoMacro(50, 0, false)).toBe("progreso");
    expect(estadoMacro(50, 0, true)).toBe("progreso");
  });
});
