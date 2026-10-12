// Prints the debug measurements logged by the Measure-* stills.
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { webpackOverride } from "./webpack-override.mjs";

const browserExecutable = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: (c) => webpackOverride(enableTailwind(c)) });
for (const id of process.argv.slice(2)) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  await renderStill({
    composition, serveUrl, output: path.resolve(`out/stills/${id}.png`), browserExecutable,
    onBrowserLog: (l) => { if (l.text.includes("MEASURE")) console.log(l.text); },
  });
}
