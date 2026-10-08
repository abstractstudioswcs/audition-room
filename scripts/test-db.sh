#!/usr/bin/env bash
# Test the database migration and access rules on a plain Postgres server.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB=audition_room_test
dropdb --if-exists "$DB"
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
psql -X -q -t -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/schema_test.sql 2>&1 | grep -E "ok -|FAIL|ERROR|passed" | sed -E 's/^(psql:[^ ]+ )?(NOTICE:  )?//'
status="${PIPESTATUS[0]}"
dropdb "$DB"
exit "$status"
