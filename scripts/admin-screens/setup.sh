#!/usr/bin/env bash
# Builds a throwaway copy of the working tree with Clerk stubbed out and starts
# it on :3100, so shoot.js can screenshot /goo-studio without real keys or data.
#
# Nothing in the repository changes: the copy lives in $ADMIN_SCREENS_DIR
# (default /tmp/goo-admin-screens). The stub signs every visitor in as a super
# admin and proxy.ts lets every request through — that is why it only ever runs
# in a throwaway copy and must never be merged into src/.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="${ADMIN_SCREENS_DIR:-/tmp/goo-admin-screens}"
APP="$WORK/app"
PORT="${ADMIN_SCREENS_PORT:-3100}"
HERE="$ROOT/scripts/admin-screens"

mkdir -p "$WORK"
pkill -f "next dev -p $PORT" 2>/dev/null || true

# 1. Copy the working tree, uncommitted changes included (an "after" shot has to
#    show the change being made). node_modules is reused between runs.
rm -rf "$APP.new" && mkdir -p "$APP.new"
(cd "$ROOT" && git ls-files -z -co --exclude-standard | xargs -0 tar -cf -) | tar -x -C "$APP.new"
[ -d "$APP/node_modules" ] && mv "$APP/node_modules" "$APP.new/node_modules"
rm -rf "$APP" && mv "$APP.new" "$APP"

# 2. Stub Clerk and open the proxy — in the copy only.
mkdir -p "$APP/src/harness"
cp "$HERE/clerk-stub.tsx" "$APP/src/harness/clerk-stub.tsx"
cat > "$APP/src/proxy.ts" <<'EOF'
import { NextResponse } from "next/server";
export default function proxy() {
  return NextResponse.next();
}
EOF
python3 - "$APP/next.config.ts" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
anchor = "const nextConfig: NextConfig = {"
assert anchor in s, "next.config.ts changed shape: update setup.sh"
s = s.replace(anchor, anchor + '\n  turbopack: { resolveAlias: { "@clerk/nextjs": "./src/harness/clerk-stub.tsx" } },', 1)
open(p, "w").write(s)
EOF

# 3. Dependencies: the app's, and playwright-core for shoot.js (it drives the
#    preinstalled Chromium; set CHROMIUM_PATH if yours lives elsewhere).
(cd "$APP" && if ! cmp -s package-lock.json node_modules/.admin-screens-lock 2>/dev/null; then
  npm ci --no-audit --no-fund --loglevel=error && cp package-lock.json node_modules/.admin-screens-lock
fi)
mkdir -p "$WORK/pw"
[ -d "$WORK/pw/node_modules/playwright-core" ] || (cd "$WORK/pw" && npm init -y >/dev/null && npm i playwright-core@1.56 --no-audit --no-fund --loglevel=error)

# 4. Start the dev server and wait until it answers.
: > "$WORK/dev.log"
# Detached from this script's stdin/stdout, so `setup.sh | tail` returns.
(cd "$APP" && NEXT_TELEMETRY_DISABLED=1 exec setsid nohup npx next dev -p "$PORT" > "$WORK/dev.log" 2>&1 < /dev/null) &
disown
for _ in $(seq 1 60); do
  grep -q "Ready" "$WORK/dev.log" 2>/dev/null && break
  sleep 1
done
grep -q "Ready" "$WORK/dev.log" || { echo "dev server did not start, see $WORK/dev.log"; exit 1; }

echo "Ready on http://localhost:$PORT. Shoot with:"
echo "  NODE_PATH=$WORK/pw/node_modules node $HERE/shoot.js --only=dashboard --theme=both --vp=both"
echo "Shots go to ${ADMIN_SCREENS_OUT:-$(node -p 'require("os").tmpdir()')/goo-admin-screens/shots}"
