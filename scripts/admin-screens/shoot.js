// Screenshots of every /goo-studio page with each /api call answered from fixtures.
// Run setup.sh first (it starts the stubbed app on :3100), then:
//   NODE_PATH=<work>/pw/node_modules node shoot.js [--only=products,users]
//     [--theme=light|dark|both] [--vp=desktop|mobile|both] [--out=DIR]
// See README.md.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright-core");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const OUT = args.out || process.env.ADMIN_SCREENS_OUT || path.join(os.tmpdir(), "goo-admin-screens", "shots");
const BASE = process.env.ADMIN_SCREENS_URL || "http://localhost:3100";
const CHROMIUM = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
fs.mkdirSync(OUT, { recursive: true });

// Load fixtures fresh each run.
const FIX = path.join(__dirname, "fixtures");
const routes = {};
const pages = [];
for (const f of fs.readdirSync(FIX).filter((f) => f.endsWith(".js") && f !== "catalog.js")) {
  const p = path.join(FIX, f);
  delete require.cache[require.resolve(p)];
  Object.keys(require.cache).forEach((k) => k.startsWith(FIX) && delete require.cache[k]);
  let m;
  try { m = require(p); } catch (e) { console.log(`! fixture ${f} failed to load: ${e.message.slice(0, 200)}`); continue; }
  Object.assign(routes, m.routes || {});
  (m.pages || []).forEach((pg) => pages.push({ ...pg, file: f }));
}

const BASE_PAGES = [
  ["dashboard", "/goo-studio"], ["products", "/goo-studio/products"], ["outfits", "/goo-studio/outfits"],
  ["brands", "/goo-studio/brands"], ["retailers", "/goo-studio/retailers"], ["audit", "/goo-studio/audit"],
  ["duplicates", "/goo-studio/duplicates"], ["catalogue-check", "/goo-studio/catalogue-check"],
  ["categories", "/goo-studio/categories"], ["blog", "/goo-studio/blog"], ["import", "/goo-studio/import"],
  ["parser", "/goo-studio/parser"], ["parser-collect", "/goo-studio/parser/collect"], ["users", "/goo-studio/users"],
  ["waitlist", "/goo-studio/waitlist"], ["email", "/goo-studio/email"], ["analytics", "/goo-studio/analytics"],
  ["subscriptions", "/goo-studio/subscriptions"], ["activity", "/goo-studio/activity"],
  ["settings", "/goo-studio/settings"], ["prompts", "/goo-studio/prompts"],
];
const all = BASE_PAGES.map(([name, url]) => ({ name, url })).concat(pages);
const only = args.only ? args.only.split(",") : null;
const list = all.filter((p) => !only || only.includes(p.name));
const themes = args.theme === "both" ? ["light", "dark"] : [args.theme || "light"];
const vps = args.vp === "both" ? ["desktop", "mobile"] : [args.vp || "desktop"];
const VIEWPORT = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

function svg(u) {
  const c = u.searchParams.get("c") || "#ddd";
  const t = (u.searchParams.get("t") || "").slice(0, 14);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750"><rect width="600" height="750" fill="#f1f0ec"/><rect x="150" y="150" width="300" height="420" rx="40" fill="${c}" stroke="#00000022" stroke-width="4"/><text x="300" y="680" font-family="sans-serif" font-size="34" text-anchor="middle" fill="#888">${t}</text></svg>`;
}

function lookup(method, u) {
  const keys = [`${method} ${u.pathname}${u.search}`, `${method} ${u.pathname}`, `* ${u.pathname}`];
  for (const k of keys) if (k in routes) return routes[k];
  // prefix patterns: "GET /api/products/*"
  for (const k of Object.keys(routes)) {
    if (k.endsWith("/*")) {
      const [m, p] = k.split(" ");
      if ((m === method || m === "*") && u.pathname.startsWith(p.slice(0, -1))) return routes[k];
    }
  }
  return undefined;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const report = [];
  for (const theme of themes) for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: VIEWPORT[vp], deviceScaleFactor: 1, isMobile: vp === "mobile", hasTouch: vp === "mobile" });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem("goo-cookie-consent", "rejected"); localStorage.setItem("goo-admin-theme", t); } catch {}
      const fixed = Date.parse("2026-10-05T12:00:00Z"); const RealDate = Date;
      // freeze "now" so relative dates are stable
      Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
    }, theme);
    await ctx.route("https://img.harness/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: svg(new URL(r.request().url())) }));
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.request().url().startsWith("https://img.harness") ? r.fallback() : r.fulfill({ status: 204, body: "" }));
    for (const pg of list) {
      const page = await ctx.newPage();
      const unmatched = new Set(); const errors = [];
      await page.route("**/api/**", async (route) => {
        const req = route.request(); const u = new URL(req.url());
        let v = lookup(req.method(), u);
        if (v === undefined) { unmatched.add(`${req.method()} ${u.pathname}${u.search}`); return route.fulfill({ json: {} }); }
        if (typeof v === "function") { let body = null; try { body = req.postDataJSON(); } catch {} v = await v({ url: u, method: req.method(), body }); }
        if (v && v.__status) return route.fulfill({ status: v.__status, json: v.__body ?? {} });
        if (v && v.__text !== undefined) return route.fulfill({ status: 200, contentType: v.__type || "text/plain", body: v.__text });
        return route.fulfill({ json: v });
      });
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 300)));
      page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 200)));
      try {
        await page.goto(BASE + pg.url, { waitUntil: "networkidle", timeout: 180000 });
        await page.waitForTimeout(pg.wait ?? 1200);
        if (pg.after) { await pg.after(page); await page.waitForTimeout(800); }
        // Hide Next dev overlay badge
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" + (pg.fullPage !== false ? ".h-dvh{height:auto!important;overflow:visible!important} main{overflow:visible!important}" : "") });
        const file = path.join(OUT, `${pg.name}--${theme}-${vp}.png`);
        await page.screenshot({ path: file, fullPage: pg.fullPage !== false });
        report.push({ page: pg.name, theme, vp, file, unmatched: [...unmatched], errors: errors.filter((e) => !/Failed to load resource|favicon|posthog/i.test(e)) });
      } catch (e) {
        report.push({ page: pg.name, theme, vp, fail: e.message.slice(0, 300), unmatched: [...unmatched], errors });
      }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  for (const r of report) {
    console.log(`\n## ${r.page} [${r.theme}/${r.vp}] ${r.fail ? "FAIL " + r.fail : "ok"}`);
    if (r.unmatched.length) console.log("  unmatched:", r.unmatched.join(" | "));
    if (r.errors.length) console.log("  errors:", [...new Set(r.errors)].slice(0, 5).join(" || "));
  }
})();
