// Screenshots and checks of the public site at phone and desktop widths, for the mobile
// track (docs/MOBILE_ROADMAP.md). Run setup.sh first (it starts the site on :3200), then:
//   NODE_PATH=<work>/pw/node_modules node shoot.js [--only=browse,product] [--theme=dark|light|both]
//     [--vp=phone|small|desktop|mobile|all] [--full] [--out=DIR] [--metrics] [--overflow]
// --full scrolls the page through (so in-view animations play) and shoots it whole.
// --metrics prints the numbers docs/MOBILE_PLAN.md measures; --overflow what scrolls sideways.
// See README.md.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright-core");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const OUT = args.out || process.env.SITE_SCREENS_OUT || path.join(os.tmpdir(), "goo-site-screens", "shots");
const BASE = process.env.SITE_SCREENS_URL || "http://localhost:3200";
const CHROMIUM = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = {
  phone: { width: 390, height: 844, mobile: true },
  small: { width: 360, height: 800, mobile: true },
  desktop: { width: 1440, height: 900, mobile: false },
};
const VP_SETS = { mobile: ["phone", "small"], all: ["phone", "small", "desktop"] };

// Finds the first button that matches any of the given locators; the names change as the
// mobile track renames things ("Open cart" → "Open bag"), so states try old and new.
async function clickFirst(page, locators) {
  for (const make of locators) {
    const loc = make(page).first();
    if (await loc.count()) { await loc.click(); return true; }
  }
  throw new Error("control not found");
}

const PAGES = [
  ["home", "/"], ["browse", "/browse"], ["product", "/product/p-001"], ["outfit", "/outfit/o-001"],
  ["builder", "/builder"], ["blog", "/blog"], ["article", "/blog/how-ai-builds-your-outfit"],
  ["saved", "/saved"], ["profile", "/profile"], ["plans", "/plans"], ["subscribe", "/subscribe?plan=pro"],
  ["cart", "/cart"], ["about", "/about"], ["privacy", "/privacy"], ["terms", "/terms"], ["cookie-policy", "/cookie"],
  ["refund", "/refund"], ["sitemap", "/sitemap-page"], ["not-found", "/no-such-page"], ["login", "/login"],
].map(([name, url]) => ({ name, url }));

const STATES = [
  { name: "ai", url: "/browse", after: (p) => clickFirst(p, [(q) => q.getByRole("button", { name: /open ai stylist/i })]) },
  { name: "cart-panel", url: "/browse", after: (p) => clickFirst(p, [(q) => q.getByRole("button", { name: /open (cart|bag)/i })]) },
  { name: "filters", url: "/browse", after: (p) => clickFirst(p, [
    (q) => q.getByRole("button", { name: /filter/i }),
    (q) => q.locator('button:has(path[d="M1 1.5H12M3 5H10M5 8.5H8"])'),
  ]) },
  { name: "search", url: "/browse", after: (p) => clickFirst(p, [
    (q) => q.getByRole("button", { name: /^search$/i }),
    (q) => q.locator('button:has(circle[r="5.5"])'),
  ]) },
  { name: "outfits", url: "/browse", after: (p) => clickFirst(p, [(q) => q.getByRole("button", { name: /^outfits$/i })]) },
  { name: "catalog-empty", url: "/browse", routes: { "/api/products": { json: [] } } },
  { name: "catalog-error", url: "/browse", routes: { "/api/products": { status: 500, json: { error: "Stand: simulated failure" } } } },
  { name: "product-stores", url: "/product/p-001", after: (p) => p.evaluate(() => {
    const h = [...document.querySelectorAll("h2,h3,p,span")].find((e) => /where to buy/i.test(e.textContent) && e.children.length === 0);
    if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90);
  }) },
  // On desktop the builder's filters are always open: there is no button to press.
  { name: "builder-filters", url: "/builder", mobileOnly: true, after: (p) => clickFirst(p, [(q) => q.getByRole("button", { name: /^filters/i })]) },
  { name: "cookie-banner", url: "/", consent: false },
];

const all = PAGES.concat(STATES);
const only = args.only ? args.only.split(",") : null;
const list = all.filter((p) => !only || only.includes(p.name));
const themes = args.theme === "both" ? ["dark", "light"] : [args.theme || "dark"];
const vps = VP_SETS[args.vp] || [args.vp || "phone"];

const COLORS = ["#c9b8a3", "#8a8f7a", "#2f3640", "#d8d2c4", "#6b5a4a", "#a7b1bf", "#3d3a36", "#e6e0d6"];
const placeholder = (i) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750"><rect width="600" height="750" fill="#efede8"/><rect x="170" y="140" width="260" height="470" rx="36" fill="${COLORS[i % COLORS.length]}"/></svg>`;

// What docs/MOBILE_PLAN.md measures on the first screen.
function measure() {
  const H = innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const all = [...document.querySelectorAll("body *")].filter((el) => !el.closest("nextjs-portal"));
  let caps = 0;
  for (const el of all) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own || !vis(el)) continue;
    if (getComputedStyle(el).textTransform === "uppercase" || /^[^a-z]*[A-Z]{3,}[^a-z]*$/.test(el.textContent.trim())) caps++;
  }
  const controls = all.filter((el) => (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button") && vis(el));
  const small = (min) => controls.filter((el) => { const r = el.getBoundingClientRect(); return r.height < min || r.width < min; }).length;
  const card = [...document.querySelectorAll('a[href^="/product/"], a[href^="/outfit/"]')]
    .map((a) => a.getBoundingClientRect()).filter((r) => r.width > 100).sort((a, b) => a.top - b.top)[0];
  const header = document.querySelector("header");
  // The bottom bar is whatever fixed element sits on the lower edge across most of the width.
  const bars = all.filter((el) => { if (getComputedStyle(el).position !== "fixed") return false; const r = el.getBoundingClientRect(); return r.bottom >= H - 40 && r.top > H / 2 && r.width > innerWidth * 0.6; });
  const navTop = bars.length ? Math.min(...bars.map((el) => el.getBoundingClientRect().top)) : H;
  const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0;
  return {
    caps,
    buttons: controls.filter((el) => el.tagName !== "A").length,
    small40: small(40),
    small44: small(44),
    firstCardTop: card ? Math.round(card.top + scrollY) : null,
    header: headerBottom,
    nav: Math.round(H - navTop),
    chrome: headerBottom + Math.round(H - navTop),
    pageWidth: document.scrollingElement.scrollWidth,
  };
}

function overflow() {
  const W = innerWidth;
  const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`;
  const out = [];
  if (document.scrollingElement.scrollWidth > W + 1) out.push(`page ${document.scrollingElement.scrollWidth}px wide`);
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.offsetParent) out.push(`scrolls sideways: ${el.scrollWidth}px in ${el.clientWidth}px — ${name(el)}`);
  }
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right <= W + 1 || getComputedStyle(el).visibility === "hidden") continue;
    const parent = el.parentElement && el.parentElement.getBoundingClientRect();
    if (parent && parent.right > W + 1) continue;
    out.push(`sticks out to ${Math.round(r.right)}px — ${name(el)}`);
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const rows = [];
  for (const theme of themes) for (const vp of vps) {
    const V = VIEWPORT[vp];
    for (const pg of list) {
      if (pg.mobileOnly && !V.mobile) continue;
      const ctx = await browser.newContext({ viewport: { width: V.width, height: V.height }, deviceScaleFactor: "metrics" in args || "overflow" in args ? 1 : 2, isMobile: V.mobile, hasTouch: V.mobile });
      await ctx.addInitScript(([t, consent]) => {
        try {
          if (consent) localStorage.setItem("goo-cookie-consent", "declined");
          localStorage.setItem("goo-theme", t);
        } catch {}
        document.addEventListener("DOMContentLoaded", () => {
          const st = document.createElement("style");
          st.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(st);
        });
      }, [theme, pg.consent !== false]);
      let n = 0;
      await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.request().resourceType() === "image"
        ? r.fulfill({ contentType: "image/svg+xml", body: placeholder(n++) })
        : r.fulfill({ status: 204, body: "" }));
      for (const [p, res] of Object.entries(pg.routes || {})) {
        await ctx.route((u) => u.pathname === p, (r) => r.fulfill({ status: res.status || 200, json: res.json }));
      }
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
      try {
        await page.goto(BASE + pg.url, { waitUntil: "networkidle", timeout: 180000 });
        await page.waitForTimeout(1200);
        if (pg.after) { await pg.after(page); await page.waitForTimeout(900); }
        const tag = `${pg.name}--${theme}-${vp}`;
        if ("metrics" in args) {
          rows.push({ page: pg.name, theme, vp, ...(await page.evaluate(measure)), errors: errors.length });
        } else if ("overflow" in args) {
          const o = await page.evaluate(overflow);
          console.log(`${tag}: ${o.length ? "\n  " + o.slice(0, 12).join("\n  ") : "fits"}`);
        } else {
          if ("full" in args) {
            await page.evaluate(async () => {
              for (let y = 0; y < document.scrollingElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
              window.scrollTo(0, 0);
            });
            await page.waitForTimeout(600);
          }
          await page.screenshot({ path: path.join(OUT, `${tag}${"full" in args ? "-full" : ""}.png`), fullPage: "full" in args });
          console.log(`${tag}${errors.length ? "  errors: " + errors.join(" | ") : ""}`);
        }
      } catch (e) {
        console.log(`${pg.name}--${theme}-${vp}: FAILED ${e.message.split("\n")[0].slice(0, 160)}`);
      }
      await ctx.close();
    }
  }
  if (rows.length) {
    console.table(rows);
    fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(rows, null, 2));
  }
  await browser.close();
  if (!("metrics" in args) && !("overflow" in args)) console.log(`Shots in ${OUT}`);
})();
