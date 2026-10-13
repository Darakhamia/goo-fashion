// Remotion config for the GOO portfolio video.
// - Tailwind v4, as in the app (the portrait card's rebuilt pieces use it).
// - "@/…" resolves to src/vendor (the app's lib/types.ts), and the currency
//   context, which would fetch live rates, is swapped for a shim (src/shims).
// - Renders with the Chromium headless shell that ships with this environment.
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

const src = path.join(process.cwd(), "src");

const SHIMS: Record<string, string> = {
  "@/lib/context/currency-context": "shims/currency-context.tsx",
};

type AliasEntry = { name: string; alias: string | false | string[]; onlyModule?: boolean };

Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
);
Config.setChromiumOpenGlRenderer("swangle");

Config.overrideWebpackConfig((current) => {
  const config = enableTailwind(current);
  const existing = config.resolve?.alias ?? {};
  const existingList: AliasEntry[] = Array.isArray(existing)
    ? (existing as AliasEntry[])
    : Object.entries(existing).map(([name, alias]) =>
        name.endsWith("$")
          ? { name: name.slice(0, -1), alias: alias as string, onlyModule: true }
          : { name, alias: alias as string },
      );
  const shims: AliasEntry[] = Object.entries(SHIMS).map(([name, file]) => ({
    name,
    alias: path.join(src, file),
    onlyModule: true,
  }));
  return {
    ...config,
    resolve: {
      ...config.resolve,
      // Order matters: the exact shims come before the "@" prefix.
      alias: [...shims, { name: "@", alias: path.join(src, "vendor") }, ...existingList],
    },
  };
});
