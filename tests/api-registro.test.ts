/**
 * Tests del endpoint de registro.
 *
 * Lo que de verdad se está probando acá es que **los límites cortan antes de
 * llamar a la API**. Por eso el SDK está espiado y las aserciones son sobre
 * "no se llamó": un límite que igual gasta la llamada no sirve de nada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITES } from "@/lib/guardrails/limites";
import { crearSupabaseFalso, type RespuestaTabla } from "./ayudas/supabase-falso";

const estimar = vi.fn();
let supabaseFalso = crearSupabaseFalso({ tablas: {} });

vi.mock("@/lib/vision/cliente", () => ({
  estimar: (...args: unknown[]) => estimar(...args),
}));

vi.mock("@/lib/supabase/cliente-servidor", () => ({
  clienteServidor: async () => supabaseFalso.cliente,
  usuarioActual: async () => ({ id: "u1" }),
}));

vi.mock("@/lib/datos/alimentos", () => ({
  listarAlimentos: async () => [],
}));

vi.mock("@/lib/datos/diario", () => ({
  fechaDeHoy: () => "2026-08-23",
  obtenerDia: async () => ({
    fecha: "2026-08-23",
    comidas: [],
    totales: { kcal: 0, proteinaG: 0, carbsG: 0, grasaG: 0 },
    objetivo: { kcal: 1850, proteinaG: 160, carbsG: 145, grasaG: 70 },
  }),
}));

const { POST } = await import("@/app/api/registro/route");

/** Monta el endpoint con los contadores que se quieran simular. */
function conCuota(tablas: Record<string, RespuestaTabla>) {
  supabaseFalso = crearSupabaseFalso({
    tablas: {
      // El mismo objeto sirve para el select (turnos, foto_path) y para el
      // insert...select("id") de una sesión nueva.
      scan_sessions: { data: { id: "s1", turnos: 0, foto_path: null }, count: 0 },
      scan_turns: { data: [] },
      ...tablas,
    },
  });
}

function peticion(cuerpo: unknown) {
  return new Request("http://localhost/api/registro", {
    method: "POST",
    body: JSON.stringify(cuerpo),
    headers: { "content-type": "application/json" },
    // El handler solo usa .json(), así que un Request estándar alcanza.
  }) as never;
}

beforeEach(() => {
  estimar.mockReset();
  estimar.mockResolvedValue({
    respuesta: {
      fuera_de_tema: false,
      momento: "almuerzo",
      items: [],
      confianza: "media",
      preguntas: [],
      nota: "ok",
    },
    tokensIn: 100,
    tokensCacheRead: 0,
    tokensOut: 50,
    costoUsd: 0.001,
    latenciaMs: 900,
  });
  conCuota({});
});

describe("los límites cortan antes de gastar", () => {
  it("una petición vacía no llega a la API", async () => {
    const res = await POST(peticion({ texto: "   " }));
    expect(res.status).toBe(400);
    expect(estimar).not.toHaveBeenCalled();
  });

  it("un mensaje demasiado largo no llega a la API", async () => {
    const res = await POST(
      peticion({ texto: "a".repeat(LIMITES.caracteresPorMensaje + 1) }),
    );
    expect(res.status).toBe(400);
    expect(estimar).not.toHaveBeenCalled();
  });

  it("el turno 7 de una sesión no llega a la API", async () => {
    conCuota({
      scan_sessions: {
        data: { id: "s1", turnos: LIMITES.turnosPorSesion, foto_path: null },
        count: 0,
      },
    });

    const res = await POST(
      peticion({
        sessionId: "11111111-1111-4111-8111-111111111111", // v4 válido: zod es estricto con el RFC
        texto: "y una arepa más",
      }),
    );

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ motivo: "demasiados_turnos" });
    expect(estimar).not.toHaveBeenCalled();
  });

  it("la sesión 21 del día no llega a la API", async () => {
    conCuota({
      scan_sessions: { data: { id: "s1" }, count: LIMITES.sesionesPorDia },
    });

    const res = await POST(peticion({ texto: "2 arepas" }));

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ motivo: "demasiadas_sesiones" });
    expect(estimar).not.toHaveBeenCalled();
  });

  it("con el tope de gasto alcanzado no llega a la API", async () => {
    // Turnos que ya suman por encima del tope del mes.
    conCuota({
      scan_turns: { data: [{ costo_usd: 6 }, { costo_usd: 5 }] },
    });

    const res = await POST(peticion({ texto: "2 arepas" }));

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ motivo: "tope_de_gasto" });
    expect(estimar).not.toHaveBeenCalled();
  });

  it("y el mensaje del tope dice que el registro manual sigue andando", async () => {
    conCuota({ scan_turns: { data: [{ costo_usd: 50 }] } });
    const res = await POST(peticion({ texto: "2 arepas" }));
    const cuerpo = await res.json();
    expect(cuerpo.error).toMatch(/manual/i);
  });
});

describe("cuando sí se puede", () => {
  it("una petición normal llama a la API una sola vez", async () => {
    const res = await POST(peticion({ texto: "2 arepas con quesito" }));

    expect(res.status).toBe(200);
    expect(estimar).toHaveBeenCalledTimes(1);
  });

  it("guarda el turno crudo con tokens y costo", async () => {
    await POST(peticion({ texto: "2 arepas con quesito" }));

    const turnos = supabaseFalso.insertados.scan_turns;
    expect(turnos).toHaveLength(1);
    expect(turnos[0]).toMatchObject({
      tokens_in: 100,
      tokens_out: 50,
      costo_usd: 0.001,
      entrada_texto: "2 arepas con quesito",
      tuvo_foto: false,
    });
  });

  it("informa cuántos turnos quedan", async () => {
    const res = await POST(peticion({ texto: "2 arepas" }));
    expect(await res.json()).toMatchObject({
      turnosRestantes: LIMITES.turnosPorSesion - 1,
    });
  });
});

describe("fuera de tema", () => {
  it("responde corto y no devuelve ítems", async () => {
    estimar.mockResolvedValue({
      respuesta: {
        fuera_de_tema: true,
        momento: "otro",
        items: [],
        confianza: "baja",
        preguntas: [],
        nota: "Solo puedo ayudarte con el registro de comidas.",
      },
      tokensIn: 50,
      tokensCacheRead: 0,
      tokensOut: 20,
      costoUsd: 0.0005,
      latenciaMs: 400,
    });

    const res = await POST(peticion({ texto: "escribime un poema" }));
    const cuerpo = await res.json();

    expect(cuerpo.fueraDeTema).toBe(true);
    expect(cuerpo.items).toBeUndefined();
    // Igual se registra: sirve para saber si hace falta un filtro más barato.
    expect(supabaseFalso.insertados.scan_turns[0]).toMatchObject({
      fuera_de_tema: true,
    });
  });
});

describe("sin sesión", () => {
  it("no llega a la API", async () => {
    supabaseFalso = crearSupabaseFalso({ tablas: {}, usuario: null });
    const res = await POST(peticion({ texto: "2 arepas" }));
    expect(res.status).toBe(401);
    expect(estimar).not.toHaveBeenCalled();
  });
});
