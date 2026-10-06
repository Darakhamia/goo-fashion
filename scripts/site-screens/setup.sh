#!/usr/bin/env bash
# Starts the public site on :3200 without real keys, for shoot.js. Reuses the admin
# stand's setup (a throwaway copy of the working tree, Clerk stubbed as a signed-in
# user, proxy open) in its own folder and port, then patches the copy once more:
# without Supabase the product page has no demo fallback (getProductById returns
# undefined), so the copy reads the bundled demo catalogue instead.
# Nothing in the repository changes; the patch lives only in the copy.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
export ADMIN_SCREENS_DIR="${SITE_SCREENS_DIR:-/tmp/goo-site-screens}"
export ADMIN_SCREENS_PORT="${SITE_SCREENS_PORT:-3200}"
# The cookie banner only exists when analytics is configured. A dummy key turns it
# on; shoot.js stores "declined" for every page but the cookie-banner state, and
# all outside hosts are stubbed, so nothing is ever sent anywhere.
export NEXT_PUBLIC_POSTHOG_KEY="${NEXT_PUBLIC_POSTHOG_KEY:-phc_site_screens_stand}"

bash "$ROOT/scripts/admin-screens/setup.sh" > /dev/null

python3 - "$ADMIN_SCREENS_DIR/app/src/lib/data/db.ts" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
old = """): Promise<Product | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined;"""
new = """): Promise<Product | undefined> {
  if (!isSupabaseConfigured || !supabase) return staticProducts.find((p) => p.id === id);"""
assert old in s, "getProductById changed shape: update scripts/site-screens/setup.sh"
open(p, "w").write(s.replace(old, new, 1))
EOF

echo "Ready on http://localhost:$ADMIN_SCREENS_PORT. Shoot with:"
echo "  NODE_PATH=$ADMIN_SCREENS_DIR/pw/node_modules node $ROOT/scripts/site-screens/shoot.js --only=browse --theme=both --vp=phone"
