/**
 * Geometría del semicírculo de los medidores.
 *
 * Radio 90 centrado en (100, 100); `t` va de 0 (izquierda) a 1 (derecha). Los
 * dos medidores de arco comparten esto para que midan lo mismo.
 */
export function puntoEnArco(t: number): { x: number; y: number } {
  const ang = Math.PI * (1 - t);
  return { x: 100 + 90 * Math.cos(ang), y: 100 - 90 * Math.sin(ang) };
}

export function trazoArco(desde: number, hasta: number): string {
  const a = puntoEnArco(desde);
  const b = puntoEnArco(hasta);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A 90 90 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}
