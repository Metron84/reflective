#!/usr/bin/env bash
# Runs the Ultima SQL tests on a throwaway local Postgres 16 cluster.
# Usage: tests/ultima/sql/run.sh   (needs root or the postgres user for initdb)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
D="$(mktemp -d /var/tmp/ultima-sql.XXXXXX)"
chmod 755 "$D"; chown postgres "$D" 2>/dev/null || true
cp "$HERE"/*.sql "$HERE"/race.sh "$D"/; cp "$ROOT"/supabase/migrations/*ultima*.sql "$D"/ 2>/dev/null || true
cp "$ROOT"/supabase/scripts/ultima_damage_*.sql "$D"/
chmod 644 "$D"/*.sql
run() { su postgres -c "$*"; }
cleanup() { run "$BIN/pg_ctl -D $D/data stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT
run "$BIN/initdb -D $D/data" >/dev/null
run "$BIN/pg_ctl -D $D/data -o '-p 5547 -k $D' -l $D/log start" >/dev/null
sleep 2
P="$BIN/psql -h $D -p 5547 -v ON_ERROR_STOP=1 -q postgres"
run "$P -f $D/stub.sql"
for f in $(ls "$D"/00*_ultima*.sql | sort); do run "$P -f $f" >/dev/null; done
run "cd $D && $P -f execute_trade.test.sql"
run "cd $D && $P -f captains.test.sql"
run "cd $D && $P -f player_card_trades.test.sql"
run "cd $D && $P -f notifications.test.sql"
run "cd $D && $P -f action_keys.test.sql"
run "bash $D/race.sh $BIN $D"
