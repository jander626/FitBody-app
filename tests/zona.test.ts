/**
 * Tests de la fecha por zona horaria.
 *
 * Este error no rompía nada visiblemente: escribía la comida en el día
 * siguiente y seguía andando. El martes quedaba con menos calorías de las que
 * fueron y el miércoles con más, y el déficit de los dos días salía mal sin
 * que nada avisara. Por eso vale fijarlo con casos concretos.
 */
import { describe, expect, it } from "vitest";
import { esZonaValida, fechaEnZona, zonaSegura, ZONA_POR_DEFECTO } from "@/lib/zona";

describe("la cena de las 8:48 PM", () => {
  // El caso real: cena registrada el martes 25 a las 20:48 en Colombia.
  const cena = new Date("2026-08-26T01:48:00Z");

  it("en Bogotá es del 25, no del 26", () => {
    expect(fechaEnZona("America/Bogota", cena)).toBe("2026-08-25");
  });

  it("en UTC —lo que hacía antes— se iba al 26", () => {
    // Este es el error que se corrigió, escrito para que no vuelva.
    expect(fechaEnZona("UTC", cena)).toBe("2026-08-26");
  });

  it("en Tokio sí es el 26, y está bien", () => {
    // No es que UTC estuviera "mal" siempre: estaba mal para quien la usa.
    expect(fechaEnZona("Asia/Tokyo", cena)).toBe("2026-08-26");
  });
});

describe("el borde del día", () => {
  it("un minuto antes de medianoche sigue siendo el mismo día", () => {
    expect(fechaEnZona("America/Bogota", new Date("2026-08-26T04:59:00Z"))).toBe(
      "2026-08-25",
    );
  });

  it("un minuto después ya es el siguiente", () => {
    expect(fechaEnZona("America/Bogota", new Date("2026-08-26T05:01:00Z"))).toBe(
      "2026-08-26",
    );
  });

  it("un desayuno temprano cae en su día", () => {
    // 6:30 AM en Bogotá = 11:30 UTC del mismo día: acá UTC acertaba, y por eso
    // el error solo aparecía de noche.
    expect(fechaEnZona("America/Bogota", new Date("2026-08-25T11:30:00Z"))).toBe(
      "2026-08-25",
    );
  });
});

describe("zonas al otro lado", () => {
  it("una zona adelantada puede estar en el día siguiente", () => {
    const mediodiaUtc = new Date("2026-08-25T12:00:00Z");
    expect(fechaEnZona("Pacific/Kiritimati", mediodiaUtc)).toBe("2026-08-26");
  });

  it("y una atrasada en el anterior", () => {
    const madrugadaUtc = new Date("2026-08-25T02:00:00Z");
    expect(fechaEnZona("Pacific/Honolulu", madrugadaUtc)).toBe("2026-08-24");
  });
});

describe("validar lo que llega del navegador", () => {
  it("acepta zonas reales", () => {
    expect(esZonaValida("America/Bogota")).toBe(true);
    expect(esZonaValida("UTC")).toBe(true);
  });

  it("rechaza lo inventado sin lanzar", () => {
    // La cookie viene del cliente: un valor cualquiera haría lanzar a Intl y
    // tumbaría el render de la pantalla entera.
    expect(esZonaValida("Marte/Olimpo")).toBe(false);
    expect(esZonaValida("")).toBe(false);
    expect(esZonaValida("'; drop table foods; --")).toBe(false);
  });
});

describe("elegir la zona a usar", () => {
  it("usa la del navegador cuando sirve", () => {
    expect(zonaSegura("Europe/Madrid", {})).toBe("Europe/Madrid");
  });

  it("sin cookie cae en la configurada", () => {
    expect(zonaSegura(null, { FITFOOD_ZONA_HORARIA: "Europe/Madrid" })).toBe(
      "Europe/Madrid",
    );
  });

  it("con una zona basura cae en la configurada, no revienta", () => {
    expect(zonaSegura("Marte/Olimpo", { FITFOOD_ZONA_HORARIA: "Europe/Madrid" })).toBe(
      "Europe/Madrid",
    );
  });

  it("sin nada, la de casa", () => {
    expect(zonaSegura(undefined, {})).toBe(ZONA_POR_DEFECTO);
  });

  it("una configuración basura tampoco pasa", () => {
    expect(zonaSegura(null, { FITFOOD_ZONA_HORARIA: "no-existe" })).toBe(
      ZONA_POR_DEFECTO,
    );
  });

  it("el respaldo no es UTC", () => {
    // UTC está garantizadamente mal para quien usa esto; la zona de casa está
    // bien casi siempre. Es una decisión, no un descuido.
    expect(ZONA_POR_DEFECTO).not.toBe("UTC");
    expect(esZonaValida(ZONA_POR_DEFECTO)).toBe(true);
  });
});
