/**
 * Días seguidos con al menos una comida registrada.
 *
 * Cuenta hacia atrás desde hoy. Si hoy todavía no hay nada, arranca desde
 * ayer: de mañana nadie ha tenido tiempo de registrar, y mostrar la racha en
 * cero a las 7 a. m. castigaría justo a quien la lleva más larga.
 */

const DIA_MS = 86_400_000;

function restarDia(fecha: string): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) - DIA_MS).toISOString().slice(0, 10);
}

export function racha(registrados: Iterable<string>, hoy: string): number {
  const conRegistro = new Set(registrados);
  let dia = conRegistro.has(hoy) ? hoy : restarDia(hoy);

  let n = 0;
  while (conRegistro.has(dia)) {
    n++;
    dia = restarDia(dia);
  }
  return n;
}

/** La fecha de hace `dias` días, para acotar la consulta de la racha. */
export function haceDias(hoy: string, dias: number): string {
  return new Date(Date.parse(`${hoy}T00:00:00Z`) - dias * DIA_MS).toISOString().slice(0, 10);
}
