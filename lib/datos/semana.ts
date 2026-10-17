import "server-only";

import { haceDias, racha } from "@/lib/racha";
import { semanaDe } from "@/lib/semana";
import { diasConRegistro } from "./diario";

/**
 * La semana que se mira y la racha, con UNA sola consulta.
 *
 * Antes eran dos (una para la franja y otra para la racha) y cada una era un
 * viaje a la base. Las dos piden lo mismo —qué días tienen comidas—, solo que
 * sobre rangos distintos: se pide el rango que cubre a las dos y se reparte en
 * memoria.
 */
export async function registroReciente(
  userId: string,
  dia: string,
  hoy: string,
): Promise<{ semana: string[]; registrados: string[]; racha: number }> {
  const semana = semanaDe(dia);
  const desdeRacha = haceDias(hoy, 60);

  const desde = semana[0] < desdeRacha ? semana[0] : desdeRacha;
  const hasta = semana[6] > hoy ? semana[6] : hoy;
  const todos = await diasConRegistro(userId, [desde, hasta]);

  return {
    semana,
    registrados: todos.filter((d) => d >= semana[0] && d <= semana[6]),
    racha: racha(todos, hoy),
  };
}
