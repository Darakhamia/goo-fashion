#!/usr/bin/env bash
#
# Step 2 of the Coolify migration — load the dump into the self-hosted Postgres.
#
#   TARGET_DB_URL='postgresql://postgres:<password>@<coolify-host>:5432/postgres' \
#     ./scripts/migrate/restore-coolify.sh
#
# The schema pass runs with ON_ERROR_STOP=0 on purpose: a self-hosted Supabase
# already ships the `anon` / `authenticated` / `service_role` roles and the
# pgvector extension, so the dump's CREATE EXTENSION and GRANT statements are
# expected to collide. The data pass runs with ON_ERROR_STOP=1 — a row that
# fails to load is a real failure and must not be swallowed.
#
set -euo pipefail

: "${TARGET_DB_URL:?set TARGET_DB_URL to the Coolify Postgres connection string}"

DUMP_DIR=${DUMP_DIR:-migration-dump}
PG_IMAGE=${PG_IMAGE:-postgres:17}

[ -f "$DUMP_DIR/schema.sql" ] || { echo "missing $DUMP_DIR/schema.sql — run dump-supabase.sh first" >&2; exit 1; }
[ -f "$DUMP_DIR/data.sql" ]   || { echo "missing $DUMP_DIR/data.sql — run dump-supabase.sh first" >&2; exit 1; }

ABS_DUMP=$(cd "$DUMP_DIR" && pwd)
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# PGPASSWORD is forwarded so the password can stay out of TARGET_DB_URL — see
# the same note in dump-supabase.sh. Coolify-generated passwords hit this too.
pg_in_docker() {
  docker run --rm \
    -v "$ABS_DUMP:/dump" \
    -v "$SCRIPT_DIR:/scripts" \
    -e PGCONNECT_TIMEOUT=30 \
    -e PGPASSWORD \
    "$PG_IMAGE" "$@"
}

psql_file() {
  local stop=$1 file=$2
  pg_in_docker psql "$TARGET_DB_URL" -v ON_ERROR_STOP="$stop" -f "$file"
}

echo "==> Prerequisites (extensions the dump assumes already exist)"
pg_in_docker psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c '
  create extension if not exists vector;
  create extension if not exists pg_trgm;'

echo "==> Restoring schema (benign duplicate-object errors are expected)"
psql_file 0 /dump/schema.sql

echo "==> Restoring data"
psql_file 1 /dump/data.sql

echo "==> Re-applying PostgREST grants"
# --no-owner keeps the dump portable but leaves the API roles without access on
# anything the dump's own GRANTs failed to cover. PostgREST connects as
# service_role, so without this the app gets "permission denied for table".
psql_file 1 /scripts/grants.sql

echo "==> Row counts (target)"
pg_in_docker psql "$TARGET_DB_URL" -At -F',' -o /dump/rowcounts-target.csv -f /scripts/rowcounts.sql

echo "==> Diff against the source counts"
if diff -u "$ABS_DUMP/rowcounts-source.csv" "$ABS_DUMP/rowcounts-target.csv"; then
  echo "Row counts match."
else
  echo "Row counts DIFFER — investigate before cutting traffic over." >&2
  exit 1
fi
