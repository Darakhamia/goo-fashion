#!/usr/bin/env bash
#
# Runs migrate-storage.mjs in a Node container, so the migration host needs
# only Docker — no Node, no npm install into the repo.
#
#   SOURCE_SUPABASE_URL='https://<ref>.supabase.co' \
#   SOURCE_SERVICE_ROLE_KEY='...' \
#   TARGET_SUPABASE_URL='https://supabase.example.com' \
#   TARGET_SERVICE_ROLE_KEY='...' \
#     ./scripts/migrate/migrate-storage.sh --dry-run
#
# Both endpoints are reached over the public internet, so no Docker network
# flag is needed here (unlike the psql scripts, which talk to a container).
#
set -euo pipefail

: "${SOURCE_SUPABASE_URL:?set SOURCE_SUPABASE_URL}"
: "${SOURCE_SERVICE_ROLE_KEY:?set SOURCE_SERVICE_ROLE_KEY}"
: "${TARGET_SUPABASE_URL:?set TARGET_SUPABASE_URL}"
: "${TARGET_SERVICE_ROLE_KEY:?set TARGET_SERVICE_ROLE_KEY}"

NODE_IMAGE=${NODE_IMAGE:-node:22-alpine}
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# The script is copied out of the read-only mount into the container's own
# working directory: Node resolves imports by walking up from the file's own
# location, so running it straight from /scripts would never find the
# node_modules that npm just installed elsewhere.
exec docker run --rm \
  -v "$SCRIPT_DIR:/scripts:ro" \
  -w /app \
  -e SOURCE_SUPABASE_URL \
  -e SOURCE_SERVICE_ROLE_KEY \
  -e TARGET_SUPABASE_URL \
  -e TARGET_SERVICE_ROLE_KEY \
  -e CONCURRENCY \
  "$NODE_IMAGE" \
  sh -c 'cp /scripts/migrate-storage.mjs /app/ \
         && npm install --silent --no-fund --no-audit @supabase/supabase-js@2 \
         && exec node /app/migrate-storage.mjs "$@"' _ "$@"
