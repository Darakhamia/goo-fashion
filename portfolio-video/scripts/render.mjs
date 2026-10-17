// Render the loop.
//   node scripts/render.mjs preview   → out/preview/goo-<format>-preview.mp4 (half size, for review)
//   node scripts/render.mjs master    → out/master/goo-<format>-master.mp4 (PNG frames, near-lossless;
//                                       scripts/encode.sh makes the deliverables from these)
//   node scripts/render.mjs card      → out/master/goo-card-master.mp4 (the portrait card's loop at
//                                       900×1200; scripts/encode-card.sh makes the deliverables)
//   node scripts/render.mjs vertical  → out/master/goo-9x16-master.mp4 (the vertical cut, with sound)
//   node scripts/render.mjs audio     → out/master/goo-9x16-audio.wav (its sound mix, lossless;
//                                       scripts/encode-vertical.sh makes the deliverables)
//   node scripts/render.mjs shorts [night|ask|pocket]
//                                     → out/master/goo-<name>-master.mp4 (the three shorts)
//   node scripts/render.mjs shorts-audio [night|ask|pocket]
//                                     → out/master/goo-<name>-audio.wav (their sound mixes;
//                                       scripts/encode-shorts.sh makes the MP4s)
//   node scripts/render.mjs films [local|colours|search]
//                                     → out/master/goo-<name>-master.mp4 (the feature films)
//   node scripts/render.mjs films-audio [local|colours|search]
//                                     → out/master/goo-<name>-audio.wav
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

const jobs =
  mode === "card" ? [["Card", "card"]]
  : mode === "vertical" || mode === "audio" ? [["GOO-9x16", "9x16"]]
  : mode === "shorts" || mode === "shorts-audio" ? [["GOO-Night", "night"], ["GOO-Ask", "ask"], ["GOO-Pocket", "pocket"]]
  : mode === "films" || mode === "films-audio" ? [["GOO-Local", "local"], ["GOO-Colours", "colours"], ["GOO-Search", "search"]]
  : [["GOO-16x9", "16x9"], ["GOO-1x1", "1x1"]];
const audioOnly = mode === "audio" || mode === "shorts-audio" || mode === "films-audio";
for (const [id, name] of jobs) {
  if (only && only !== name) continue;
  const composition = await selectComposition({ serveUrl, id, browserExecutable });
  const preview = mode === "preview";
  const dir = path.resolve("out", preview ? "preview" : "master");
  fs.mkdirSync(dir, { recursive: true });
  const outputLocation = audioOnly
    ? path.join(dir, `goo-${name}-audio.wav`)
    : path.join(dir, `goo-${name}-${preview ? "preview" : "master"}.mp4`);
  const t0 = Date.now();
  let last = -1;
  if (audioOnly) {
    await renderMedia({ composition, serveUrl, outputLocation, codec: "wav", browserExecutable, chromiumOptions: { gl: "swangle" } });
    console.log(`${outputLocation} in ${Math.round((Date.now() - t0) / 1000)} s`);
    continue;
  }
  await renderMedia({
    composition,
    serveUrl,
    outputLocation,
    codec: "h264",
    crf: preview ? 20 : 4,
    imageFormat: preview ? "jpeg" : "png",
    jpegQuality: 92,
    scale: preview ? 0.5 : mode === "card" ? 0.75 : 1,
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
