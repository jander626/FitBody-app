const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];

/** La semana con sus días registrados, sin navegación: solo para mirar. */
export function FranjaSoloLectura({
  semana,
  hoy,
  registrados,
}: {
  semana: string[];
  hoy: string;
  registrados: string[];
}) {
  const con = new Set(registrados);
  return (
    <div className="grid grid-cols-7 rounded-3xl border border-hairline bg-surface px-2 py-3" role="group" aria-label="Semana">
      {semana.map((dia, i) => (
        <div key={dia} className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-muted">{INICIALES[i]}</span>
          <span className={`text-sm font-medium ${dia === hoy ? "text-ink" : "text-muted"}`}>{Number(dia.slice(8))}</span>
          <span
            key={con.has(dia) ? "si" : "no"}
            className={`size-2.5 rounded-full ${con.has(dia) ? (dia === hoy ? "pop bg-accent" : "bg-accent") : "bg-hairline"}`}
            style={dia === hoy ? { animationDelay: "350ms" } : undefined}
            aria-label={con.has(dia) ? "con registro" : "sin registro"}
          />
        </div>
      ))}
    </div>
  );
}
