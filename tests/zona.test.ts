/**
 * Tests de la fecha por zona horaria.
 *
 * Este error no rompía nada visiblemente: escribía la comida en el día
 * siguiente y seguía andando. El martes quedaba con menos calorías de las que
 * fueron y el miércoles con más, y el déficit de los dos días salía mal sin
 * que nada avisara. Por eso vale fijarlo con casos concretos.
 */
import { describe, expect, it } from "vitest";
import {
  aValorDeCookie,
  COOKIE_ZONA,
  esZonaValida,
  fechaEnZona,
  zonaDeCookies,
  zonaSegura,
  ZONA_POR_DEFECTO,
} from "@/lib/zona";

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

describe("la cookie: lo que se escribe es lo que se lee", () => {
  // Este bloque existe por un bug que llegó a producción. La cookie se
  // guardaba codificada y se comparaba contra la zona sin decodificar, así
  // que la comparación *nunca* podía dar igual: la app se recargaba a sí
  // misma en bucle —144 veces en 6 segundos medidas en un navegador real— y
  // el campo del correo del login se borraba solo. Nadie podía entrar.
  //
  // La invariante que faltaba es de una línea: lo que se escribe tiene que
  // volver idéntico. Se prueba con las zonas de verdad, que todas llevan
  // barra, que es el carácter que se codifica.
  const zonas = [
    "America/Bogota",
    "Asia/Tokyo",
    "Pacific/Honolulu",
    "America/Argentina/Buenos_Aires",
    "UTC",
  ];

  it.each(zonas)("%s vuelve igual de la cookie", (zona) => {
    const cookies = `otra=cosa; ${COOKIE_ZONA}=${aValorDeCookie(zona)}; tema=oscuro`;
    expect(zonaDeCookies(cookies)).toBe(zona);
  });

  it("la barra sí se codifica al guardar", () => {
    // Si algún día esto deja de ser cierto, el test de arriba pasa por la
    // razón equivocada. Acá queda explícito qué es lo que se está sorteando.
    expect(aValorDeCookie("America/Bogota")).toBe("America%2FBogota");
  });

  it("sin la cookie devuelve null, no una cadena vacía", () => {
    // Importa la diferencia: null significa "primera visita" y dispara la
    // corrección; "" sería un valor que compararía mal contra cualquier zona.
    expect(zonaDeCookies("tema=oscuro; otra=cosa")).toBeNull();
    expect(zonaDeCookies("")).toBeNull();
    expect(zonaDeCookies(undefined)).toBeNull();
  });

  it("no confunde una cookie cuyo nombre empieza igual", () => {
    expect(zonaDeCookies(`${COOKIE_ZONA}-vieja=Asia%2FTokyo`)).toBeNull();
  });

  it("un valor corrupto no lanza", () => {
    // Un % suelto hace lanzar a decodeURIComponent. Preferimos devolver algo
    // que no coincide —una corrección de más— a tumbar el componente.
    expect(() => zonaDeCookies(`${COOKIE_ZONA}=100%`)).not.toThrow();
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
