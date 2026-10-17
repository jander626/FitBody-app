/**
 * Lo que se ve mientras llega una pantalla.
 *
 * Sin esto, tocar un botón de la barra no cambiaba nada en pantalla hasta que
 * el servidor terminaba de armar la página, y ese silencio es lo que se siente
 * como "lenta" aunque la espera sea la misma. Con un esqueleto, la pantalla
 * responde al toque al instante y el contenido se acomoda cuando llega.
 *
 * Un solo esqueleto genérico para todas las pantallas de dentro: un título, una
 * tarjeta grande y dos chicas. No pretende parecerse a ninguna; pretende no
 * saltar mucho cuando aparece la de verdad.
 */
export default function Cargando() {
  return (
    <div className="px-5 pt-8" aria-busy="true" aria-label="Cargando">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-hairline-soft" />
      <div className="mt-5 h-64 animate-pulse rounded-3xl bg-hairline-soft" />
      <div className="mt-4 h-24 animate-pulse rounded-3xl bg-hairline-soft" />
      <div className="mt-4 h-24 animate-pulse rounded-3xl bg-hairline-soft" />
    </div>
  );
}
