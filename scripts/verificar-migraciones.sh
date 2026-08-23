#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres limpio y corre las pruebas de RLS.
#
# No toca el proyecto de Supabase: levanta una instancia desechable, verifica
# que el SQL es válido y que el aislamiento entre usuarios se sostiene, y borra
# todo al terminar.
#
#   ./scripts/verificar-migraciones.sh
#   ./scripts/verificar-migraciones.sh --dejar-vivo   # no apaga la base al salir
#
# --dejar-vivo la deja escuchando en 127.0.0.1:$PUERTO para regenerar los tipos
# con scripts/gen-tipos-db.ts. Hay que apagarla a mano después (el script dice
# cómo).
#
# Requiere los binarios de PostgreSQL (en Debian/Ubuntu: postgresql-16).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PUERTO="${PUERTO:-5433}"
PGDATA="$(mktemp -d)/pgdata"
SOCKET=/tmp
DEJAR_VIVO=0
[ "${1:-}" = "--dejar-vivo" ] && DEJAR_VIVO=1

# Postgres se niega a correr como root. Si somos root (contenedores, CI) hay
# que delegar en el usuario postgres; si no, ya estamos bien como estamos.
if [ "$(id -u)" -eq 0 ]; then
  como_pg() { su postgres -c "$1"; }
  preparar_dir() { chmod o+x "$(dirname "$PGDATA")"; chown postgres:postgres "$PGDATA"; }
else
  como_pg() { bash -c "$1"; }
  preparar_dir() { :; }
fi

limpiar() {
  [ "$DEJAR_VIVO" -eq 1 ] && return 0
  como_pg "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$(dirname "$PGDATA")"
}
trap limpiar EXIT

echo "→ Levantando Postgres desechable en el puerto $PUERTO"
mkdir -p "$PGDATA"
preparar_dir
como_pg "$PGBIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null
como_pg "$PGBIN/pg_ctl -D $PGDATA -o '-p $PUERTO -h 127.0.0.1 -k $SOCKET' -l $PGDATA/log start -w" >/dev/null

export PGHOST=127.0.0.1 PGPORT="$PUERTO" PGUSER=postgres
psql -q -c "create database fitfood_test" postgres

echo "→ Aplicando stubs y migraciones"
psql -v ON_ERROR_STOP=1 -q -d fitfood_test -f "$RAIZ/supabase/tests/00_stub_supabase.sql"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -d fitfood_test -f "$f"
done

echo "→ Probando el aislamiento entre usuarios"
psql -v ON_ERROR_STOP=1 -q -d fitfood_test -f "$RAIZ/supabase/tests/01_rls.sql"

# Los tipos se versionan, así que pueden quedar desfasados de las migraciones
# sin que nada se queje hasta que una consulta falla en producción. Acá se
# regeneran y se comparan.
echo "→ Comprobando que los tipos coincidan con el esquema"
TIPOS="$RAIZ/lib/supabase/tipos-db.ts"
cp "$TIPOS" "$PGDATA/tipos-antes.ts"
PGDATABASE=fitfood_test npx tsx "$RAIZ/scripts/gen-tipos-db.ts" >/dev/null
if ! diff -q "$PGDATA/tipos-antes.ts" "$TIPOS" >/dev/null; then
  echo "✗ lib/supabase/tipos-db.ts está desfasado del esquema."
  echo "  Ya se regeneró: revisá el diff y commiteálo."
  diff "$PGDATA/tipos-antes.ts" "$TIPOS" | head -40
  exit 1
fi
echo "   tipos al día"

# Ensayo de la importación: se traduce la bitácora real con el mismo lector que
# usa el importador y se inserta todo. Si algo no entra en el esquema, se ve
# acá y no a mitad de una importación de verdad.
BITACORA="${FITFOOD_REPO_PATH:-$RAIZ/../fitfood}"
if [ -d "$BITACORA/data/comidas" ]; then
  echo "→ Ensayando la importación de la bitácora ($BITACORA)"
  psql -q -c "create database fitfood_import" postgres
  psql -v ON_ERROR_STOP=1 -q -d fitfood_import -f "$RAIZ/supabase/tests/00_stub_supabase.sql"
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    psql -v ON_ERROR_STOP=1 -q -d fitfood_import -f "$f"
  done
  FITFOOD_REPO_PATH="$BITACORA" npx tsx "$RAIZ/scripts/importacion-a-sql.ts" > "$PGDATA/import.sql"
  psql -v ON_ERROR_STOP=1 -q -d fitfood_import -f "$PGDATA/import.sql"
else
  echo "→ Sin clon de la bitácora en $BITACORA: se salta el ensayo de importación"
fi

echo "✓ Migraciones, RLS e importación en verde"

if [ "$DEJAR_VIVO" -eq 1 ]; then
  cat <<FIN

La base quedó viva en 127.0.0.1:$PUERTO (base "fitfood_test").
Para regenerar los tipos:

  PGPORT=$PUERTO PGDATABASE=fitfood_test npx tsx scripts/gen-tipos-db.ts

Para apagarla cuando termines:

  $( [ "$(id -u)" -eq 0 ] && echo "su postgres -c '$PGBIN/pg_ctl -D $PGDATA stop'" || echo "$PGBIN/pg_ctl -D $PGDATA stop" )
  rm -rf $(dirname "$PGDATA")
FIN
fi
