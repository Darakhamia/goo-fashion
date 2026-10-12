// The same aliases remotion.config.ts sets for the CLI, for scripts that bundle
// through @remotion/bundler directly.
import path from "node:path";

const src = path.resolve("src");
const SHIMS = {
  "next/link": "shims/next-link.tsx",
  "next/image": "shims/next-image.tsx",
  "framer-motion": "shims/framer-motion.tsx",
  "@/lib/context/likes-context": "shims/likes-context.tsx",
  "@/lib/context/auth-context": "shims/auth-context.tsx",
  "@/lib/context/currency-context": "shims/currency-context.tsx",
  "@/lib/context/cart-context": "shims/cart-context.tsx",
};

export function webpackOverride(config) {
  const existing = config.resolve?.alias ?? {};
  const existingList = Array.isArray(existing)
    ? existing
    : Object.entries(existing).map(([name, alias]) =>
        name.endsWith("$") ? { name: name.slice(0, -1), alias, onlyModule: true } : { name, alias },
      );
  const shims = Object.entries(SHIMS).map(([name, file]) => ({ name, alias: path.join(src, file), onlyModule: true }));
  return {
    ...config,
    resolve: { ...config.resolve, alias: [...shims, { name: "@", alias: path.join(src, "vendor") }, ...existingList] },
  };
}
