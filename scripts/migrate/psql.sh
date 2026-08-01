#!/usr/bin/env bash
#
# Ad-hoc psql against the migrated database — used by the URL-rewrite (step 8)
# and verification (step 9) steps, and handy for poking at the result.
#
# Wraps the same two workarounds the other scripts need:
#   - joins the Coolify service network, since Postgres is not published on the
#     host and is only addressable by container name
#   - carries PGPASSWORD, so passwords containing URI metacharacters do not have
#     to be percent-encoded into TARGET_DB_URL
#
#   export DOCKER_NETWORK=<coolify service network>
#   export TARGET_DB_URL='postgresql://postgres@supabase-db-<id>:5432/postgres'
#   read -s -p 'Password: ' PGPASSWORD; export PGPASSWORD; echo
#
#   ./scripts/migrate/psql.sh -f /scripts/verify.sql
#
# Files in this directory are mounted at /scripts inside the container.
#
set -euo pipefail

: "${TARGET_DB_URL:?set TARGET_DB_URL to the Coolify Postgres connection string}"

PG_IMAGE=${PG_IMAGE:-postgres:17}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

DOCKER_ARGS=()
if [ -n "${DOCKER_NETWORK:-}" ]; then
  DOCKER_ARGS+=(--network "$DOCKER_NETWORK")
fi

exec docker run --rm -i \
  "${DOCKER_ARGS[@]}" \
  -v "$SCRIPT_DIR:/scripts" \
  -e PGCONNECT_TIMEOUT=30 \
  -e PGPASSWORD \
  "$PG_IMAGE" psql "$TARGET_DB_URL" "$@"
