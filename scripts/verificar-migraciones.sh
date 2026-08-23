#!/usr/bin/env bash
# Aplica las migraciones sobre un Postgres limpio y corre las pruebas de RLS.
#
# No toca el proyecto de Supabase: levanta una instancia desechable, verifica
# que el SQL es válido y que el aislamiento entre usuarios se sostiene, y borra
# todo al terminar.
#
#   ./scripts/verificar-migraciones.sh
#
# Requiere los binarios de PostgreSQL (en Debian/Ubuntu: postgresql-16).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PUERTO="${PUERTO:-5433}"
PGDATA="$(mktemp -d)/pgdata"
SOCKET=/tmp

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
  como_pg "$PGBIN/pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$(dirname "$PGDATA")"
}
trap limpiar EXIT

echo "→ Levantando Postgres desechable en el puerto $PUERTO"
mkdir -p "$PGDATA"
preparar_dir
como_pg "$PGBIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null
como_pg "$PGBIN/pg_ctl -D $PGDATA -o '-p $PUERTO -k $SOCKET' -l $PGDATA/log start -w" >/dev/null

export PGHOST="$SOCKET" PGPORT="$PUERTO" PGUSER=postgres
psql -q -c "create database fitfood_test" postgres

echo "→ Aplicando stubs y migraciones"
psql -v ON_ERROR_STOP=1 -q -d fitfood_test -f "$RAIZ/supabase/tests/00_stub_supabase.sql"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -d fitfood_test -f "$f"
done

echo "→ Probando el aislamiento entre usuarios"
psql -v ON_ERROR_STOP=1 -q -d fitfood_test -f "$RAIZ/supabase/tests/01_rls.sql"

echo "✓ Migraciones y RLS en verde"
