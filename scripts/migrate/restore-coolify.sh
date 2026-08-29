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

# Coolify does not publish the Postgres port on the host, so the client has to
# join the service's own Docker network and address the database by container
# name. Set DOCKER_NETWORK to that network (docker ps --format '{{.Networks}}').
DOCKER_ARGS=()
if [ -n "${DOCKER_NETWORK:-}" ]; then
  DOCKER_ARGS+=(--network "$DOCKER_NETWORK")
fi

# PGPASSWORD is forwarded so the password can stay out of TARGET_DB_URL — see
# the same note in dump-supabase.sh. Coolify-generated passwords hit this too.
pg_in_docker() {
  docker run --rm \
    "${DOCKER_ARGS[@]}" \
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

echo "==> Target server version"
pg_in_docker psql "$TARGET_DB_URL" -At -c 'show server_version'

# The data dump carries `ALTER TABLE ... DISABLE TRIGGER ALL` (from
# --disable-triggers), and disabling a foreign key's system trigger is
# superuser-only. In a self-hosted Supabase `postgres` is NOT a superuser —
# `supabase_admin` is. Connecting as postgres gets six tables in and then dies
# on the first table another table references, so check up front.
echo "==> Checking the connecting role is a superuser"
if [ "$(pg_in_docker psql "$TARGET_DB_URL" -At -c 'select usesuper from pg_user where usename = current_user')" != "t" ]; then
  cat >&2 <<'HINT'
ERROR: the role in TARGET_DB_URL is not a superuser.

The data pass has to disable foreign-key triggers, which only a superuser may
do. In a self-hosted Supabase that role is supabase_admin, not postgres:

  export TARGET_DB_URL='postgresql://supabase_admin@supabase-db-<id>:5432/postgres'

The password is the same POSTGRES_PASSWORD.
HINT
  exit 1
fi

echo "==> Prerequisites (extensions the dump assumes already exist)"
pg_in_docker psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c '
  create extension if not exists vector;
  create extension if not exists pg_trgm;'

# pg_dump 17 opens every file with `SET transaction_timeout = 0;`, a GUC that
# does not exist before PG 17. Supabase Cloud runs 17 while the self-hosted
# image is older, so the data pass dies on line 13 — before a single row loads.
# Stripping the line is better than relaxing ON_ERROR_STOP on that pass, which
# would also swallow genuine failures. Originals are left untouched.
echo "==> Stripping SET directives the older target does not know"
for f in schema data; do
  grep -v '^SET transaction_timeout' "$ABS_DUMP/$f.sql" > "$ABS_DUMP/$f.restore.sql"
done

echo "==> Restoring schema (benign duplicate-object errors are expected)"
psql_file 0 /dump/schema.restore.sql

echo "==> Clearing existing rows (COPY appends, so a re-run would double them)"
psql_file 1 /scripts/truncate-public.sql

echo "==> Restoring data"
psql_file 1 /dump/data.restore.sql

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
