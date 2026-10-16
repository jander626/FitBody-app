/**
 * La semana de una fecha, de lunes a domingo.
 *
 * Es la franja que se ve arriba en Hoy. Se calcula en UTC sobre la fecha
 * AAAA-MM-DD, igual que el resto de la aritmética de días de la app: así no
 * cambia según la zona horaria ni el horario de verano.
 */

const DIA_MS = 86_400_000;

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Las siete fechas de la semana que contiene `fecha`, lunes primero. */
export function semanaDe(fecha: string): string[] {
  const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const desdeLunes = (diaSemana + 6) % 7;
  const lunes = sumarDias(fecha, -desdeLunes);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}
