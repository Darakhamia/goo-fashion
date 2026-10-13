// Shared Playwright setup for the captures.
//
// Pages come from the real app running locally (see capture/README.md). Every
// request that would leave the machine is answered from capture/fixtures/remote/
// instead: partner-CDN product photos, store favicons. With COPY_MISSING=1 a file
// that is not there yet is copied once and kept; without it the request is
// aborted, so a capture run is offline once the copies exist. Anything else
// external (Clerk's script, analytics) is aborted and logged.
const { chromium } = require("playwright");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
const MOCK = process.env.MOCK_ORIGIN ?? "http://127.0.0.1:54321";
const REMOTE = path.join(__dirname, "fixtures/remote");
const COPY_MISSING = process.env.COPY_MISSING === "1";
const EXECUTABLE = process.env.CHROMIUM ?? undefined;

const DESKTOP = { width: 1440, height: 900, dpr: 2 };
const PHONE = { width: 390, height: 844, dpr: 2, mobile: true };

const ext = (url, type) => {
  const m = new URL(url).pathname.match(/\.(webp|png|jpe?g|avif|gif|svg|ico)$/i);
  if (m) return m[1].toLowerCase();
  if (type?.includes("png")) return "png";
  if (type?.includes("jpeg")) return "jpg";
  if (type?.includes("webp")) return "webp";
  if (type?.includes("avif")) return "avif";
  if (type?.includes("svg")) return "svg";
  if (type?.includes("icon")) return "ico";
  return "bin";
};

const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", avif: "image/avif", gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon", bin: "application/octet-stream" };

/** Index of copied files: url → file name, so a file keeps its URL's identity. */
const INDEX = path.join(REMOTE, "index.json");
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
const saveIndex = () => fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + "\n");

async function handleExternal(route) {
  const req = route.request();
  const url = req.url();
  const isImage = req.resourceType() === "image" || /s2\/favicons/.test(url);
  if (!isImage) {
    console.log(`  blocked ${req.resourceType()} ${url.slice(0, 100)}`);
    return route.abort();
  }
  const known = index[url];
  if (known && fs.existsSync(path.join(REMOTE, known))) {
    const file = path.join(REMOTE, known);
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { "content-type": MIME[path.extname(file).slice(1)] ?? "application/octet-stream", "access-control-allow-origin": "*" } });
  }
  if (!COPY_MISSING) {
    console.log(`  remote MISS ${url.slice(0, 120)}`);
    return route.abort();
  }
  const res = await route.fetch();
  const body = await res.body();
  if (res.status() !== 200) {
    console.log(`  remote ${res.status()} ${url.slice(0, 120)}`);
    return route.fulfill({ response: res });
  }
  fs.mkdirSync(REMOTE, { recursive: true });
  const name = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + "." + ext(url, res.headers()["content-type"]);
  fs.writeFileSync(path.join(REMOTE, name), body);
  index[url] = name;
  saveIndex();
  console.log(`  remote copied ${url.slice(0, 100)}`);
  return route.fulfill({ response: res, body });
}

async function launch() {
  return chromium.launch({ executablePath: EXECUTABLE });
}

/** A page on the local app: light theme, cookie choice made, nothing external. */
async function newPage(browser, device = DESKTOP, { theme = "light" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: !!device.mobile,
    hasTouch: !!device.mobile,
    colorScheme: theme,
    locale: "en-US",
    timezoneId: "Europe/London",
  });
  // The build carries a placeholder Clerk key (a development instance), whose
  // middleware sends a browser with no dev-browser cookie to Clerk's handshake.
  // These are the cookies a signed-out visitor holds after that handshake, so
  // the page renders signed out, as it does for a first visit to the live site.
  const host = new URL(BASE).hostname;
  await ctx.addCookies([
    { name: "__clerk_db_jwt", value: "dvb_fixture", domain: host, path: "/" },
    { name: "__client_uat", value: "0", domain: host, path: "/" },
  ]);
  // Seeded Math.random: the builder shuffles its catalogue strip on every load,
  // and the captures of one scene must show the same strip.
  await ctx.addInitScript(() => {
    let s = 0x9e3779b9;
    Math.random = () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("goo-cookie-consent", "declined");
      // A returning visitor: the header's one-time "AI Stylist" tip is gone.
      localStorage.setItem("ai-tooltip-dismissed", "1");
      localStorage.setItem("goo-theme", t);
    } catch {}
  }, theme);
  await ctx.route((url) => !url.href.startsWith(BASE) && !url.href.startsWith(MOCK) && !url.href.startsWith("data:") && !url.href.startsWith("blob:"), handleExternal);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  pageerror ${String(e).slice(0, 200)}`));
  return page;
}

/**
 * Wait for fonts, and for every <img> that intersects the viewport to finish.
 * Lazy images further down never start, so they are not waited for.
 */
async function settle(page, ms = 400) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    const vh = innerHeight, vw = innerWidth;
    const visible = [...document.images].filter((im) => {
      const r = im.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0;
    });
    const done = visible.map((im) => (im.complete ? null : new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); })));
    await Promise.race([Promise.all(done), new Promise((r) => setTimeout(r, 20000))]);
  });
  await page.waitForTimeout(ms);
}

/** Bounding box of an element in CSS px, page-relative to the viewport. */
async function rect(locator) {
  const b = await locator.boundingBox();
  return b && { x: b.x, y: b.y, w: b.width, h: b.height };
}

module.exports = { BASE, DESKTOP, PHONE, launch, newPage, settle, rect };
