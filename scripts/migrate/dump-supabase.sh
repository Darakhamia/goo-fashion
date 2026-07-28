#!/usr/bin/env bash
#
# Step 1 of the Coolify migration — dump the `public` schema out of Supabase Cloud.
#
# Runs pg_dump inside a Postgres container so the client version always matches
# (or exceeds) the server; a locally installed pg_dump that is older than the
# Supabase server refuses to run and the error message is not obvious.
#
#   SOURCE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
#     ./scripts/migrate/dump-supabase.sh
#
# Use the *session* pooler (port 5432) or the direct connection — pg_dump cannot
# run through the transaction pooler on port 6543.
#
set -euo pipefail

: "${SOURCE_DB_URL:?set SOURCE_DB_URL to the Supabase connection string}"

OUT_DIR=${OUT_DIR:-migration-dump}
PG_IMAGE=${PG_IMAGE:-postgres:17}

mkdir -p "$OUT_DIR"
ABS_OUT=$(cd "$OUT_DIR" && pwd)
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

run_pg_dump() {
  docker run --rm \
    -v "$ABS_OUT:/dump" \
    -e PGCONNECT_TIMEOUT=30 \
    "$PG_IMAGE" pg_dump "$SOURCE_DB_URL" "$@"
}

echo "==> Server version"
docker run --rm "$PG_IMAGE" psql "$SOURCE_DB_URL" -At -c 'show server_version'

# Schema and data are dumped separately so the restore can tolerate benign
# errors in the schema pass (extensions/roles that already exist in a
# self-hosted Supabase) while still failing hard if any row fails to load.
echo "==> Dumping schema  -> $OUT_DIR/schema.sql"
run_pg_dump \
  --schema=public \
  --schema-only \
  --no-owner \
  --quote-all-identifiers \
  --file=/dump/schema.sql

echo "==> Dumping data    -> $OUT_DIR/data.sql"
run_pg_dump \
  --schema=public \
  --data-only \
  --no-owner \
  --disable-triggers \
  --quote-all-identifiers \
  --file=/dump/data.sql

echo "==> Row counts (source, for the post-restore comparison)"
docker run --rm -v "$ABS_OUT:/dump" -v "$SCRIPT_DIR:/scripts" "$PG_IMAGE" \
  psql "$SOURCE_DB_URL" -At -F',' -o /dump/rowcounts-source.csv -f /scripts/rowcounts.sql

cat "$ABS_OUT/rowcounts-source.csv"

echo
echo "Done. Files in $OUT_DIR:"
ls -lh "$ABS_OUT"
