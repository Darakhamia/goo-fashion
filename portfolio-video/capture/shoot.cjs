// Captures the real GOO app, running locally on fixtures, for the promo video.
//
//   NODE_PATH=/opt/node-tools/node_modules node capture/shoot.cjs [scene …]
//   scenes: catalogue builder stylist product hero   (default: these five, the main promo)
//           night ask pocket hero-light              (the three short variants)
//
// Writes PNGs at deviceScaleFactor 2 to public/captures/ and the geometry the
// video needs (element rectangles, in CSS px of the captured image) to
// public/captures/manifest.json. The video only moves, crops and layers these
// captures; it draws no UI of its own.
const fs = require("node:fs");
const path = require("node:path");
const { BASE, DESKTOP, PHONE, launch, newPage, settle } = require("./browser.cjs");

const OUT = path.join(__dirname, "../public/captures");
const MANIFEST = path.join(OUT, "manifest.json");
fs.mkdirSync(OUT, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const save = () => fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
/** Set a manifest entry by dotted key ("night.builder") and save. */
const put = (key, value) => {
  const parts = key.split(".");
  let o = manifest;
  for (const k of parts.slice(0, -1)) o = o[k] ??= {};
  o[parts.at(-1)] = value;
  save();
};

// The look the builder assembles, in the order the pieces arrive (total $1,945).
const LOOK = [
  ["outerwear", "20e50770-f5a5-432e-b203-996186b71393"], // Purple Brand Suede Carpenter Jacket, $1,295
  ["top", "b4addee7-f109-4b1b-a07b-b831429a8377"], // Purple Brand Countries Tee, $95
  ["bottom", "77b032e3-13e7-4f95-aadb-ec54170c8143"], // Purple Brand P001 Legacy Blues, $200
  ["shoes", "6575d398-1a28-4a7a-a1fd-91fad620ef92"], // Air Jordan 1 Retro High OG 'Royal' 2026, $155
  ["accessories", "ffc021a5-1264-43d5-86ba-c20a43f0581e"], // Purple Brand V001 Skye sunglasses, $200
];
const builderUrl = (k, look = LOOK) => "/builder" + (k ? "?" + look.slice(0, k).map(([s, id]) => `${s}=${id}`).join("&") : "");

// The featured product: the one with the illustrative stores (fixtures/illustrative.json).
const FEATURED = "6575d398-1a28-4a7a-a1fd-91fad620ef92";

// The scripted stylist exchange. No model is called: the app's request to
// /api/stylist/chat is answered with this, in the route's own response shape
// (src/app/api/stylist/chat/route.ts, StylistChatResponse).
const STYLIST = {
  question: "All black for a gallery opening",
  reply: "Tonal and sharp: a black leather trucker over a wide long sleeve, black trousers and the Jordan 8 'Chrome'.",
  pieces: [
    "1f484c38-3b18-42cf-9b4f-c33f46ce658a", // Purple Brand Leather Bonded Trucker Jacket, $1,295
    "1b234e5c-486f-4bea-bfd6-1ff1cb622733", // Purple Brand Digital Seraph Wide Long Sleeve, $175
    // A "bottoms" piece, not "jeans": the drawer's CATEGORY_TO_SLOT maps only
    // bottoms to the builder's bottom slot, so jeans would leave "Build this
    // look" a piece short.
    "6bf714ad-e69a-478b-af4c-5c719dddc927", // Purple Brand Half & Half All Around Pant, $345
    "52acdf03-7710-488e-8140-5f509eea7682", // Air Jordan 8 Retro 'Chrome' 2026, $239
  ],
};

// ── The three short variants ─────────────────────────────────────────────────
// "Night": the dark theme, a darker look (total $1,779).
const NIGHT_LOOK = [
  ["outerwear", "fbf9d334-cd59-4153-bc89-b3cb2d6fef88"], // Purple Brand Leather Mix Jacket, $990
  ["top", "4d13cf80-a096-49b1-8789-fbc428abedfc"], // Purple Brand 9 Lives Wide Long Sleeve, $175
  ["bottom", "4ce82ffe-b20d-4b6c-ad0a-2db0e507df1e"], // Purple Brand P013 Clean Tapered, $275
  ["shoes", "15aa55f5-3349-4552-b8b4-91d493870faf"], // Air Jordan 3 'True Blue' 2026, $158.65
  ["accessories", "25eb6f52-58fb-456c-b73e-ad530925ad42"], // Purple Brand V002 Mercer, $180
];
const NIGHT_PATH = "/browse?category=outerwear";

// "Ask": the stylist answers, and "Build this look" fills an empty builder.
const ASK = {
  question: "Smart casual for a dinner date",
  reply: "Easy but put together: a tan twill jacket over a washed tee, black trousers and clean white low-tops.",
  pieces: [
    "b9f52491-68e5-483f-895d-b1305ca464f1", // Purple Brand Overdyed Twill Jacket, $495
    "e13fa82f-d245-4267-9e9f-1fba372575ab", // Purple Brand Cities Tee, $150
    "6bf714ad-e69a-478b-af4c-5c719dddc927", // Purple Brand Half & Half All Around Pant, $345 (bottoms, see above)
    "5bf66a72-160b-4d24-b447-0fd2d320378b", // Nike SB Air Force 1 Low 'White Iron Grey', $136.14
  ],
};
// The same four pieces as builder slots, in the order the board fills (total $1,126).
const ASK_LOOK = [["outerwear", ASK.pieces[0]], ["top", ASK.pieces[1]], ["bottom", ASK.pieces[2]], ["shoes", ASK.pieces[3]]];

// "Pocket": the phone, from search results to the featured sneaker's stores.
const POCKET_SEARCH = "/browse?search=Jordan%201";

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/db/products.json"), "utf8"));
const byPrefix = (p) => {
  const r = rows.find((x) => x.id.startsWith(p) && x.is_group_primary !== false) ?? rows.find((x) => x.id.startsWith(p));
  if (!r) throw new Error(`no fixture product ${p}`);
  return r;
};

const shot = (name) => path.join(OUT, name);
const rel = (b, origin = { x: 0, y: 0 }) => b && { x: +(b.x - origin.x).toFixed(2), y: +(b.y - origin.y).toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };

// ── Catalogue: the browse grid ───────────────────────────────────────────────
async function catalogue(browser, { key = "catalogue", prefix = "catalogue", path: url = "/browse", theme = "light" } = {}) {
  const page = await newPage(browser, DESKTOP, { theme });
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  // The grid's photos load lazily, as they scroll into view; a full-page
  // screenshot never scrolls, so ask for them all now.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((im) => (im.loading = "eager")));
  // Cards also reveal as they scroll into view: scroll through once.
  await page.evaluate(async () => {
    for (let y = 0; y < 3600; y += 250) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  const N = 16;
  const geo = await page.evaluate(async (N) => {
    const grid = [...document.querySelectorAll("div.grid.stagger-children")].find((g) => g.offsetParent && g.querySelector('a[href^="/product/"]'));
    const cards = [...grid.children].slice(0, N);
    // Hover layers and the like never load while hidden; wait only for shown photos.
    const imgs = cards.flatMap((c) => [...c.querySelectorAll("img")]).filter((im) => im.getBoundingClientRect().width > 0 && getComputedStyle(im).visibility !== "hidden");
    const loads = imgs.map((im) => (im.complete ? null : new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); })));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 30000))]);
    const abs = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; };
    return {
      grid: abs(grid),
      cards: cards.map((c) => ({
        href: c.querySelector('a[href^="/product/"]')?.getAttribute("href"),
        card: abs(c),
        photo: abs(c.querySelector('[class*="aspect-[3/4]"]')),
        // The card's main photo (colour variants stack more images behind it).
        broken: (() => { const im = c.querySelector('[class*="aspect-[3/4]"] img'); return !im || !im.naturalWidth; })(),
      })),
      bg: getComputedStyle(document.body).backgroundColor,
    };
  }, N);
  await page.waitForTimeout(1500); // the grid's stagger-in animation
  const M = 40;
  const first = geo.cards[0].card, last = geo.cards[N - 1].card;
  const clip = { x: geo.grid.x - M, y: first.y - M, width: geo.grid.width + 2 * M, height: last.y + last.height - first.y + 2 * M };
  await page.screenshot({ path: shot(`${prefix}.png`), fullPage: true, clip });
  // The same grid with its photos hidden: the cards' frames, names and prices.
  await page.addStyleTag({ content: '[class*="aspect-[3/4]"] img { visibility: hidden !important; }' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: shot(`${prefix}-frames.png`), fullPage: true, clip });
  const o = { x: clip.x, y: clip.y };
  put(key, {
    image: `captures/${prefix}.png`,
    frames: `captures/${prefix}-frames.png`,
    size: { w: clip.width, h: clip.height },
    background: geo.bg,
    cards: geo.cards.map((c) => ({ href: c.href, card: rel(c.card, o), photo: rel(c.photo, o), broken: c.broken })),
  });
  console.log(`${key}: ${N} cards, broken photos: ${geo.cards.filter((c) => c.broken).length}`);
  await page.context().close();
}

// ── Builder: the phone canvas, one piece at a time ──────────────────────────
async function builder(browser, { key = "builder", prefix = "builder", look = LOOK, theme = "light" } = {}) {
  const states = [];
  for (let k = 0; k <= look.length; k++) {
    const page = await newPage(browser, PHONE, { theme });
    await page.goto(BASE + builderUrl(k, look), { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    const geo = await page.evaluate(() => {
      const canvas = document.querySelector('div[style*="min-height"][style*="210px"]');
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
      const pill = canvas.querySelector("span.absolute.left-3.bottom-3");
      return {
        canvas: r(canvas),
        cells: [...canvas.querySelectorAll("img")].map((im) => ({ name: im.alt, cell: r(im.parentElement), img: r(im) })),
        pill: pill ? r(pill) : null,
        pillText: pill?.textContent ?? null,
      };
    });
    const file = `${prefix}-${k}.png`;
    await page.screenshot({ path: shot(file) });
    states.push({
      image: `captures/${file}`,
      canvas: rel(geo.canvas),
      cells: geo.cells.map((c) => ({ name: c.name, cell: rel(c.cell), img: rel(c.img) })),
      pill: rel(geo.pill),
      pillText: geo.pillText,
    });
    console.log(`${key} ${k}: ${geo.cells.length} cells, ${geo.pillText ?? "no total"}`);
    await page.context().close();
  }
  put(key, { size: { w: PHONE.width, h: PHONE.height }, states });
}

// ── Stylist: the phone sheet, a typed question, a scripted look ─────────────
async function stylist(browser, { key = "stylist", prefix = "stylist", script = STYLIST, theme = "light", under = builderUrl(LOOK.length), followLook = false } = {}) {
  const page = await newPage(browser, PHONE, { theme });
  const pieces = script.pieces.map(byPrefix);
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/api/stylist/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: script.reply,
        suggestedProductIds: pieces.map((p) => p.id),
        suggestedProducts: pieces.map((p) => ({
          id: p.id, name: p.name, brand: p.brand, category: p.category,
          priceMin: p.price_min, currency: p.currency, imageUrl: p.image_url, styleKeywords: p.style_keywords,
        })),
        styleKeywords: [],
        remaining: null,
        limit: null,
      }),
    });
  });
  await page.goto(BASE + under, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
  await page.getByRole("button", { name: "Open AI Stylist" }).click();
  const dialog = page.getByRole("dialog", { name: "AI Stylist chat" });
  await dialog.waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot(`${prefix}-open.png`) });

  const input = dialog.getByRole("textbox", { name: "Ask your stylist" });
  await input.click();
  const bar = await page.evaluate(() => {
    const i = document.querySelector('input[aria-label="Ask your stylist"]');
    let bar = i.parentElement;
    while (bar && !bar.querySelector('[aria-label="Send"]')) bar = bar.parentElement;
    const b = bar.getBoundingClientRect();
    const s = bar.querySelector('[aria-label="Send"]').getBoundingClientRect();
    return { x: b.left, y: b.top, width: b.width, height: b.height, send: { x: s.left - b.left, y: s.top - b.top, w: s.width, h: s.height } };
  });
  const typed = [];
  const q = script.question;
  for (let i = 0; i <= q.length; i++) {
    if (i > 0) await page.keyboard.type(q[i - 1]);
    await page.waitForTimeout(60);
    const caret = await page.evaluate(() => {
      // Where the browser's caret sits: the end of the typed text.
      const i = document.querySelector('input[aria-label="Ask your stylist"]');
      const cs = getComputedStyle(i);
      const c = document.createElement("canvas").getContext("2d");
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const r = i.getBoundingClientRect();
      const x = r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth) + c.measureText(i.value).width - i.scrollLeft;
      const lh = parseFloat(cs.fontSize) * 1.25;
      return { x, y: r.top + r.height / 2 - lh / 2, width: 1.5, height: lh, color: cs.color };
    });
    const file = `${prefix}-type-${String(i).padStart(2, "0")}.png`;
    await page.screenshot({ path: shot(file), clip: bar });
    typed.push({ image: `captures/${file}`, chars: i, caret: { ...rel(caret, bar), color: caret.color } });
  }
  await page.keyboard.press("Enter");
  await dialog.locator(".animate-bounce").first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot(`${prefix}-sent.png`) });
  release();
  await dialog.getByText("Build this look").first().waitFor();
  await page.waitForTimeout(600);
  await settle(page, 1200);
  await page.screenshot({ path: shot(`${prefix}-reply.png`) });
  const geo = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="AI Stylist chat"]');
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
    const bubbles = [...d.querySelectorAll('div[class*="max-w-[88%]"]')];
    const strip = d.querySelector("div.flex.gap-2.overflow-x-auto");
    const look = [...d.querySelectorAll("a")].find((a) => a.textContent.includes("Build this look") && a.offsetParent);
    return {
      sheet: r(d),
      bubbles: bubbles.map((b) => ({ text: b.textContent.slice(0, 60), rect: r(b) })),
      strip: r(strip),
      cards: strip ? [...strip.children].map(r) : [],
      look: r(look),
    };
  });
  const entry = {
    size: { w: PHONE.width, h: PHONE.height },
    open: `captures/${prefix}-open.png`,
    sent: `captures/${prefix}-sent.png`,
    reply: `captures/${prefix}-reply.png`,
    question: q,
    bar: rel(bar),
    send: bar.send,
    typed,
    sheet: rel(geo.sheet),
    bubbles: geo.bubbles.map((b) => ({ text: b.text, rect: rel(b.rect) })),
    strip: rel(geo.strip),
    cards: geo.cards.map((c) => rel(c)),
    look: rel(geo.look),
  };
  if (followLook) {
    // Press "Build this look" as a visitor would, and record where it leads.
    await page.locator("a", { hasText: "Build this look" }).filter({ visible: true }).first().click();
    await page.waitForURL(/\/builder\?/);
    entry.lookHref = new URL(page.url()).search;
  }
  put(key, entry);
  console.log(`${key}: ${typed.length} typing frames, ${geo.cards.length} suggested pieces${entry.lookHref ? `, look opens ${entry.lookHref}` : ""}`);
  await page.context().close();
}

// ── Product: the page with its stores ────────────────────────────────────────
async function product(browser) {
  const page = await newPage(browser, DESKTOP);
  await page.goto(BASE + `/product/${FEATURED}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  await page.screenshot({ path: shot("product.png") });
  const geo = await page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
    const wtb = document.getElementById("where-to-buy");
    const rows = [...wtb.querySelectorAll("div.hidden.md\\:block > a")];
    const main = [...document.querySelectorAll("main img")].map((i) => i.closest("div.rounded-2xl, div.rounded-xl, div[class*='rounded']")).find((d) => d && d.getBoundingClientRect().width > 500);
    const title = document.querySelector("main h1");
    let info = wtb.parentElement;
    while (info && info.getBoundingClientRect().height < 600) info = info.parentElement;
    return { whereToBuy: r(wtb), rows: rows.map(r), photo: r(main), title: r(title), info: r(info), storeCount: rows.length };
  });
  manifest.product = {
    image: "captures/product.png",
    size: { w: DESKTOP.width, h: DESKTOP.height },
    whereToBuy: rel(geo.whereToBuy),
    rows: geo.rows.map((x) => rel(x)),
    photo: rel(geo.photo),
    title: rel(geo.title),
    info: rel(geo.info),
  };
  save();
  console.log(`product: ${geo.storeCount} store rows`);
  await page.context().close();
}

// ── Hero: the big GOO, for the end card (the site's dark theme) ──────────────
async function hero(browser, { themes = ["dark"] } = {}) {
  manifest.hero ??= {};
  for (const theme of themes) {
    const page = await newPage(browser, DESKTOP, { theme });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settle(page, 800);
    // The hero word morphs GOO → Looks → …; wait until GOO is settled crisp.
    await page.waitForFunction(() => {
      const ts = [...document.querySelectorAll("svg text")];
      const g = ts.find((t) => t.textContent === "GOO" && parseFloat(t.style.opacity) >= 0.999 && !t.getAttribute("filter"));
      return g && !g.closest("g[filter]");
    }, null, { timeout: 60000, polling: 30 });
    // Freeze the background's CSS animation, so the two shots below share one
    // background: the hero as it is, then the same frame with GOO, the line under
    // it and the button hidden. The end card reveals the first over the second.
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }" });
    const file = `hero-${theme}.png`;
    await page.screenshot({ path: shot(file) });
    const geo = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
      const word = [...document.querySelectorAll("svg text")].find((t) => t.textContent === "GOO");
      const button = [...document.querySelectorAll("a")].find((a) => a.textContent.trim().startsWith("Build your look") && a.offsetParent);
      const line = [...document.querySelectorAll("p, span, h2")].find((e) => e.textContent.trim() === "Build your look" && e.offsetParent && !e.closest("a"));
      const out = { word: r(word), svg: r(word.ownerSVGElement), button: r(button), line: r(line) };
      for (const el of [word.ownerSVGElement, button, line]) if (el) el.style.visibility = "hidden";
      return out;
    });
    await page.screenshot({ path: shot(`hero-${theme}-bg.png`) });
    manifest.hero[theme] = { image: `captures/${file}`, background: `captures/hero-${theme}-bg.png`, size: { w: DESKTOP.width, h: DESKTOP.height }, word: rel(geo.word), svg: rel(geo.svg), line: rel(geo.line), button: rel(geo.button) };
    save();
    console.log(`hero ${theme}: GOO at`, manifest.hero[theme].word);
    await page.context().close();
  }
}

// ── Pocket: the phone, scrolled and tapped ───────────────────────────────────
// A scrolling page is captured in layers, the way the phone composes it: the
// whole page in one tall image (the fixed bars hidden), and each fixed bar on
// its own over a transparent background. The video scrolls the page under the
// bars.

/** Load every lazy photo of a long page and reveal its cards, then go back to the top. */
async function loadAll(page) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((im) => (im.loading = "eager")));
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 250) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
    scrollTo(0, 0);
  });
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("main img")].filter((im) => im.getBoundingClientRect().width > 0 && getComputedStyle(im).visibility !== "hidden");
    const loads = imgs.map((im) => (im.complete ? null : new Promise((r) => { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); })));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 30000))]);
  });
  await page.waitForTimeout(1200);
}

/**
 * The page in full, with the fixed bars (`hide`, CSS selectors) out of the way.
 * The sticky header keeps its place in the flow, as blank page, and the video
 * lays the header's own layer over it.
 */
async function fullPage(page, file, hide) {
  const tag = await page.addStyleTag({ content: `${hide.join(", ")} { visibility: hidden !important; }` });
  await page.screenshot({ path: shot(file), fullPage: true });
  await tag.evaluate((t) => t.remove());
}

/**
 * One fixed element alone, on a transparent background: everything that is
 * not it, or one of its ancestors, is made invisible, and the ancestors paint
 * no background. Restores the page afterwards. Returns its rectangle.
 */
async function layer(page, selector, file) {
  const rect = await page.evaluate((selector) => {
    const keep = document.querySelector(selector);
    const undo = [];
    const set = (el, prop, value) => { undo.push([el, prop, el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]); el.style.setProperty(prop, value, "important"); };
    for (let el = keep; el && el !== document.documentElement; el = el.parentElement) {
      const parent = el.parentElement;
      for (const sib of parent.children) if (sib !== el) set(sib, "visibility", "hidden");
      if (parent !== document.documentElement) set(parent, "background", "transparent");
    }
    set(document.documentElement, "background", "transparent");
    window.__undoLayer = () => undo.reverse().forEach(([el, p, v, pr]) => (v ? el.style.setProperty(p, v, pr) : el.style.removeProperty(p)));
    const b = keep.getBoundingClientRect();
    return { x: b.left, y: b.top, width: b.width, height: b.height };
  }, selector);
  await page.waitForTimeout(100);
  // A few px around it, for its border's anti-aliasing.
  const pad = 4;
  const clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.width + 2 * pad, height: rect.height + 2 * pad };
  clip.width = Math.min(clip.width, PHONE.width - clip.x);
  clip.height = Math.min(clip.height, PHONE.height - clip.y);
  await page.screenshot({ path: shot(file), clip, omitBackground: true });
  await page.evaluate(() => window.__undoLayer());
  return rel(clip);
}

const NAV = "header";
const TABS = "div.md\\:hidden.fixed.inset-x-3"; // the tab bar, and on a product page the buy bar

async function pocket(browser, { key = "pocket", prefix = "pocket", search = POCKET_SEARCH, item = FEATURED, theme = "light" } = {}) {
  const entry = { size: { w: PHONE.width, h: PHONE.height } };

  // 1. Search results, scrolled down to the featured sneaker.
  {
    const page = await newPage(browser, PHONE, { theme });
    await page.goto(BASE + search, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await loadAll(page);
    const geo = await page.evaluate((item) => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, width: b.width, height: b.height }; };
      const a = document.querySelector(`main a[href="/product/${item}"]`);
      let card = a;
      while (card && !card.parentElement.matches("div.grid")) card = card.parentElement;
      return { height: document.documentElement.scrollHeight, card: r(card), photo: r(card.querySelector('[class*="aspect-[3/4]"]')), cards: card.parentElement.children.length };
    }, item);
    await fullPage(page, `${prefix}-browse.png`, [NAV, TABS]);
    entry.browse = {
      url: search,
      image: `captures/${prefix}-browse.png`,
      size: { w: PHONE.width, h: geo.height },
      card: rel(geo.card),
      photo: rel(geo.photo),
      cards: geo.cards,
      nav: { image: `captures/${prefix}-browse-nav.png`, rect: await layer(page, NAV, `${prefix}-browse-nav.png`) },
      tabs: { image: `captures/${prefix}-browse-tabs.png`, rect: await layer(page, TABS, `${prefix}-browse-tabs.png`) },
    };
    console.log(`${key} browse: ${geo.cards} cards, page ${geo.height}px, the sneaker's card at y ${Math.round(geo.card.y)}`);
    await page.context().close();
  }

  // 2. The sneaker's page: "Where to buy" scrolls to the stores, the bag takes it.
  {
    const page = await newPage(browser, PHONE, { theme });
    await page.goto(BASE + `/product/${item}`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await loadAll(page);
    const geo = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, width: b.width, height: b.height }; };
      const wtb = document.getElementById("where-to-buy");
      const bar = document.querySelector('div.md\\:hidden.fixed.inset-x-3');
      return {
        height: document.documentElement.scrollHeight,
        whereToBuy: r(wtb),
        rows: [...wtb.querySelectorAll("div.md\\:hidden > a")].map(r),
        bag: r(bar.querySelector("button")),
        go: r(bar.querySelector('a[href="#where-to-buy"]')),
      };
    });
    await fullPage(page, `${prefix}-product.png`, [NAV, TABS]);
    const state = async (s) => ({
      nav: { image: `captures/${prefix}-product-nav${s}.png`, rect: await layer(page, NAV, `${prefix}-product-nav${s}.png`) },
      bar: { image: `captures/${prefix}-product-bar${s}.png`, rect: await layer(page, TABS, `${prefix}-product-bar${s}.png`) },
    });
    const before = await state("");
    // Tap "Where to buy", as a visitor would, and let the smooth scroll finish.
    await page.locator('a[href="#where-to-buy"]').click();
    await page.waitForFunction(() => new Promise((res) => { const y = scrollY; setTimeout(() => res(scrollY === y && y > 0), 1000); }), null, { polling: 100, timeout: 15000 });
    const scrollTo = await page.evaluate(() => scrollY);
    await page.screenshot({ path: shot(`${prefix}-product-stores.png`) });
    // Then the bag.
    await page.getByRole("button", { name: "Add to bag" }).click();
    await page.getByRole("button", { name: "Remove from bag" }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot(`${prefix}-product-bagged.png`) });
    // The count that appears on the header's bag.
    const badge = await page.evaluate(() => {
      const b = [...document.querySelectorAll("header button span.absolute")].find((e) => e.offsetParent && e.textContent.trim() === "1");
      const r = b.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    const after = await state("-bagged");
    entry.product = {
      url: `/product/${item}`,
      image: `captures/${prefix}-product.png`,
      size: { w: PHONE.width, h: geo.height },
      // Viewport shots, for checking the layered composite against.
      check: { stores: `captures/${prefix}-product-stores.png`, bagged: `captures/${prefix}-product-bagged.png` },
      whereToBuy: rel(geo.whereToBuy),
      rows: geo.rows.map((x) => rel(x)),
      bag: rel(geo.bag), // the bar's buttons, in the viewport (the page is at the top)
      go: rel(geo.go),
      scrollTo,
      badge: rel(badge),
      before,
      after,
    };
    console.log(`${key} product: page ${geo.height}px, ${geo.rows.length} store rows, "Where to buy" scrolls to ${scrollTo}`);
    await page.context().close();
  }
  put(key, entry);
}

const nightCatalogue = (browser) => catalogue(browser, { key: "night.catalogue", prefix: "night-catalogue", path: NIGHT_PATH, theme: "dark" });
const night = async (browser) => {
  await catalogue(browser, { key: "night.catalogue", prefix: "night-catalogue", path: NIGHT_PATH, theme: "dark" });
  await builder(browser, { key: "night.builder", prefix: "night-builder", look: NIGHT_LOOK, theme: "dark" });
};
const ask = async (browser) => {
  await stylist(browser, { key: "ask.stylist", prefix: "ask-stylist", script: ASK, under: "/builder", followLook: true });
  await builder(browser, { key: "ask.builder", prefix: "ask-builder", look: ASK_LOOK });
  const want = builderUrl(ASK_LOOK.length, ASK_LOOK).slice("/builder".length);
  if (manifest.ask.stylist.lookHref !== want) console.warn(`ask: "Build this look" opens ${manifest.ask.stylist.lookHref}, the builder states show ${want}`);
};
const heroLight = (browser) => hero(browser, { themes: ["light"] });

const SCENES = { catalogue, builder, stylist, product, hero, night, ask, pocket, "hero-light": heroLight, "night-catalogue": nightCatalogue };
(async () => {
  const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
  const browser = await launch();
  try {
    for (const s of wanted) {
      console.log(`== ${s}`);
      await SCENES[s](browser);
    }
  } finally {
    await browser.close();
  }
})();
