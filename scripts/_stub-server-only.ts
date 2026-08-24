// `server-only` es un marcador que rompe el build si un módulo de servidor
// termina en el bundle del cliente. En un script de Node no aplica, así que
// tsconfig.scripts.json lo mapea acá (ver scripts/eval-registro.ts).
export {};
