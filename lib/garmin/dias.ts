/**
 * Los últimos días, para pedir un dato por día.
 *
 * Se calcula con `Date.UTC` a partir de una fecha ya resuelta en la zona de
 * quien mira —la que da `fechaDeHoy()`— y no con `new Date()`. Un cálculo de
 * calendario que arranca de "ahora" en el servidor devuelve el día equivocado
 * de noche en Colombia; ese error ya se pagó una vez.
 */

const DIA_MS = 86_400_000;

/** De la más vieja a la más nueva, terminando en `hasta`. */
export function ultimosDias(hasta: string, cuantos: number): string[] {
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(fin) || cuantos <= 0) return [];
  return Array.from({ length: cuantos }, (_, i) =>
    new Date(fin - (cuantos - 1 - i) * DIA_MS).toISOString().slice(0, 10),
  );
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/**
 * El día de la semana, abreviado.
 *
 * Sirve más de lo que parece: cuando alguien transcribe números mirando una
 * gráfica de Garmin, las columnas están rotuladas por día de la semana, no por
 * fecha. Sin esto hay que ir contando.
 */
export function nombreDia(fecha: string): string {
  const t = Date.parse(`${fecha}T00:00:00Z`);
  return Number.isNaN(t) ? "" : DIAS[new Date(t).getUTCDay()];
}
