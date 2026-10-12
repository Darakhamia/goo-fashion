// Render selected frames as PNG stills, for review.
//   node scripts/stills.mjs <outDir> <scale> <comp>:<frame>[,<frame>…] …
// e.g. node scripts/stills.mjs out/stills 0.5 GOO-16x9:0,62,150 GOO-1x1:300
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";

const [outDir, scaleArg, ...specs] = process.argv.slice(2);
const scale = Number(scaleArg || 1);
const browserExecutable = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

import { webpackOverride } from "./webpack-override.mjs";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: (c) => webpackOverride(enableTailwind(c)) });

for (const spec of specs) {
  const [id, frames] = spec.split(":");
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  for (const f of (frames ?? "0").split(",").map(Number)) {
    const output = path.join(outDir, `${id}-${String(f).padStart(3, "0")}.png`);
    await renderStill({ composition, serveUrl, output, frame: f, scale, browserExecutable, chromiumOptions: { gl: "swangle" } });
    console.log(output);
  }
}
