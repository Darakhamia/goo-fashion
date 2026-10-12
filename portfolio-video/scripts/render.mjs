// Render the loop.
//   node scripts/render.mjs preview   → out/preview/goo-<format>-preview.mp4 (half size, for review)
//   node scripts/render.mjs master    → out/master/goo-<format>-master.mp4 (PNG frames, near-lossless;
//                                       scripts/encode.sh makes the deliverables from these)
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { webpackOverride } from "./webpack-override.mjs";

const mode = process.argv[2] ?? "preview";
const only = process.argv[3];
const browserExecutable = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), webpackOverride: (c) => webpackOverride(enableTailwind(c)) });

for (const [id, name] of [["GOO-16x9", "16x9"], ["GOO-1x1", "1x1"]]) {
  if (only && only !== name) continue;
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const preview = mode === "preview";
  const dir = path.resolve("out", preview ? "preview" : "master");
  fs.mkdirSync(dir, { recursive: true });
  const outputLocation = path.join(dir, `goo-${name}-${preview ? "preview" : "master"}.mp4`);
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    outputLocation,
    codec: "h264",
    crf: preview ? 20 : 4,
    imageFormat: preview ? "jpeg" : "png",
    jpegQuality: 92,
    scale: preview ? 0.5 : 1,
    x264Preset: preview ? "veryfast" : "medium",
    concurrency: 4,
    browserExecutable,
    chromiumOptions: { gl: "swangle" },
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) { last = p; console.log(`${name} ${p * 10}%`); }
    },
  });
  console.log(`${outputLocation} in ${Math.round((Date.now() - t0) / 1000)} s`);
}
