#!/usr/bin/env bash
# Runs every migration and the RLS test suite against a throwaway local
# Postgres cluster. Needs the Postgres server binaries (initdb, pg_ctl).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN_AS=(sudo -u postgres)
fi

run() { "${RUN_AS[@]}" "$@"; }

cleanup() { run "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

run "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
run "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/supabase/tests/shim.sql"
for m in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$m")"
  "${PSQL[@]}" -f "$m"
done
for t in "$ROOT"/supabase/tests/*.test.sql; do
  echo "test     $(basename "$t")"
  "${PSQL[@]}" -o /dev/null -f "$t"
done
echo "all database tests passed"
