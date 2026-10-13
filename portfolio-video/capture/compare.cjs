// Side-by-side check: the same three views from goo-fashion.com and from the
// local app on fixtures, at the same viewport and scale, plus a pixel diff.
//
//   NODE_PATH=/opt/node-tools/node_modules node capture/compare.cjs OUT_DIR
//
// Run once, before the video is built; nothing in the render depends on it.
// The live pages are loaded as a first-time visitor would see them, with the
// same settled state the captures use (cookie choice made, the one-time AI tip
// dismissed, light theme, Math.random seeded so the builder strip matches).
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { BASE, DESKTOP, PHONE, launch, newPage, settle } = require("./browser.cjs");

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const LIVE = "https://goo-fashion.com";

const LOOK = "/builder?outerwear=20e50770-f5a5-432e-b203-996186b71393&top=b4addee7-f109-4b1b-a07b-b831429a8377&bottom=77b032e3-13e7-4f95-aadb-ec54170c8143&shoes=6575d398-1a28-4a7a-a1fd-91fad620ef92&accessories=ffc021a5-1264-43d5-86ba-c20a43f0581e";
// The featured product, as the video shows it. Locally it carries the two
// illustrative store rows (fixtures/illustrative.json); live has only Goat.
const PRODUCT = "/product/6575d398-1a28-4a7a-a1fd-91fad620ef92";

const VIEWS = [
  { name: "1-browse-grid", device: DESKTOP, path: "/browse", prepare: browseGrid },
  { name: "2-builder-phone", device: PHONE, path: LOOK },
  { name: "3-product", device: DESKTOP, path: PRODUCT },
];

async function browseGrid(page) {
  // The same framing as the catalogue capture: the first two rows of the grid.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((im) => (im.loading = "eager")));
  await page.evaluate(async () => {
    for (let y = 0; y < 1600; y += 250) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
  });
  const y = await page.evaluate(() => {
    const grid = [...document.querySelectorAll("div.grid.stagger-children")].find((g) => g.offsetParent && g.querySelector('a[href^="/product/"]'));
    return grid.getBoundingClientRect().top + scrollY - 24;
  });
  await page.evaluate((y) => scrollTo(0, y), y);
  await page.waitForTimeout(1200);
}

async function livePage(browser, device) {
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: !!device.mobile,
    hasTouch: !!device.mobile,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "Europe/London",
  });
  await ctx.addInitScript(() => {
    let s = 0x9e3779b9;
    Math.random = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      localStorage.setItem("goo-cookie-consent", "declined");
      localStorage.setItem("ai-tooltip-dismissed", "1");
      localStorage.setItem("goo-theme", "light");
    } catch {}
  });
  return ctx.newPage();
}

(async () => {
  const browser = await launch();
  for (const v of VIEWS) {
    for (const side of ["live", "local"]) {
      const page = side === "live" ? await livePage(browser, v.device) : await newPage(browser, v.device);
      await page.goto((side === "live" ? LIVE : BASE) + v.path, { waitUntil: "domcontentloaded", timeout: 60000 });
      await settle(page, 2000);
      if (v.prepare) await v.prepare(page);
      await settle(page, 800);
      await page.screenshot({ path: path.join(OUT, `${v.name}-${side}.png`) });
      console.log(`${v.name} ${side}`);
      await page.context().close();
    }
  }
  await browser.close();
})();
