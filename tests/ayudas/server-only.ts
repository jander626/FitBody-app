// `server-only` existe solo para romper el build si un módulo de servidor
// termina en el bundle del cliente. En los tests no aporta nada, así que se
// reemplaza por este módulo vacío (ver vitest.config.mts).
export {};
