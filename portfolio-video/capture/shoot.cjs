// Captures the real GOO app, running locally on fixtures, for the promo video.
//
//   NODE_PATH=/opt/node-tools/node_modules node capture/shoot.cjs [scene …]
//   scenes: catalogue builder stylist product hero   (default: all)
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

// The look the builder assembles, in the order the pieces arrive (total $1,945).
const LOOK = [
  ["outerwear", "20e50770-f5a5-432e-b203-996186b71393"], // Purple Brand Suede Carpenter Jacket, $1,295
  ["top", "b4addee7-f109-4b1b-a07b-b831429a8377"], // Purple Brand Countries Tee, $95
  ["bottom", "77b032e3-13e7-4f95-aadb-ec54170c8143"], // Purple Brand P001 Legacy Blues, $200
  ["shoes", "6575d398-1a28-4a7a-a1fd-91fad620ef92"], // Air Jordan 1 Retro High OG 'Royal' 2026, $155
  ["accessories", "ffc021a5-1264-43d5-86ba-c20a43f0581e"], // Purple Brand V001 Skye sunglasses, $200
];
const builderUrl = (k) => "/builder" + (k ? "?" + LOOK.slice(0, k).map(([s, id]) => `${s}=${id}`).join("&") : "");

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

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/db/products.json"), "utf8"));
const byPrefix = (p) => {
  const r = rows.find((x) => x.id.startsWith(p) && x.is_group_primary !== false) ?? rows.find((x) => x.id.startsWith(p));
  if (!r) throw new Error(`no fixture product ${p}`);
  return r;
};

const shot = (name) => path.join(OUT, name);
const rel = (b, origin = { x: 0, y: 0 }) => b && { x: +(b.x - origin.x).toFixed(2), y: +(b.y - origin.y).toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };

// ── Catalogue: the browse grid ───────────────────────────────────────────────
async function catalogue(browser) {
  const page = await newPage(browser, DESKTOP);
  await page.goto(BASE + "/browse", { waitUntil: "domcontentloaded" });
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
  await page.screenshot({ path: shot("catalogue.png"), fullPage: true, clip });
  // The same grid with its photos hidden: the cards' frames, names and prices.
  await page.addStyleTag({ content: '[class*="aspect-[3/4]"] img { visibility: hidden !important; }' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: shot("catalogue-frames.png"), fullPage: true, clip });
  const o = { x: clip.x, y: clip.y };
  manifest.catalogue = {
    image: "captures/catalogue.png",
    frames: "captures/catalogue-frames.png",
    size: { w: clip.width, h: clip.height },
    background: geo.bg,
    cards: geo.cards.map((c) => ({ href: c.href, card: rel(c.card, o), photo: rel(c.photo, o), broken: c.broken })),
  };
  save();
  console.log(`catalogue: ${N} cards, broken photos: ${geo.cards.filter((c) => c.broken).length}`);
  await page.context().close();
}

// ── Builder: the phone canvas, one piece at a time ──────────────────────────
async function builder(browser) {
  const states = [];
  for (let k = 0; k <= LOOK.length; k++) {
    const page = await newPage(browser, PHONE);
    await page.goto(BASE + builderUrl(k), { waitUntil: "domcontentloaded" });
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
    const file = `builder-${k}.png`;
    await page.screenshot({ path: shot(file) });
    states.push({
      image: `captures/${file}`,
      canvas: rel(geo.canvas),
      cells: geo.cells.map((c) => ({ name: c.name, cell: rel(c.cell), img: rel(c.img) })),
      pill: rel(geo.pill),
      pillText: geo.pillText,
    });
    console.log(`builder ${k}: ${geo.cells.length} cells, ${geo.pillText ?? "no total"}`);
    await page.context().close();
  }
  manifest.builder = { size: { w: PHONE.width, h: PHONE.height }, states };
  save();
}

// ── Stylist: the phone sheet, a typed question, a scripted look ─────────────
async function stylist(browser) {
  const page = await newPage(browser, PHONE);
  const pieces = STYLIST.pieces.map(byPrefix);
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/api/stylist/chat", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: STYLIST.reply,
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
  await page.goto(BASE + builderUrl(LOOK.length), { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
  await page.getByRole("button", { name: "Open AI Stylist" }).click();
  const dialog = page.getByRole("dialog", { name: "AI Stylist chat" });
  await dialog.waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot("stylist-open.png") });

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
  const q = STYLIST.question;
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
    const file = `stylist-type-${String(i).padStart(2, "0")}.png`;
    await page.screenshot({ path: shot(file), clip: bar });
    typed.push({ image: `captures/${file}`, chars: i, caret: { ...rel(caret, bar), color: caret.color } });
  }
  await page.keyboard.press("Enter");
  await dialog.locator(".animate-bounce").first().waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shot("stylist-sent.png") });
  release();
  await dialog.getByText("Build this look").first().waitFor();
  await page.waitForTimeout(600);
  await settle(page, 1200);
  await page.screenshot({ path: shot("stylist-reply.png") });
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
  manifest.stylist = {
    size: { w: PHONE.width, h: PHONE.height },
    open: "captures/stylist-open.png",
    sent: "captures/stylist-sent.png",
    reply: "captures/stylist-reply.png",
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
  save();
  console.log(`stylist: ${typed.length} typing frames, ${geo.cards.length} suggested pieces`);
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
async function hero(browser) {
  manifest.hero = {};
  for (const theme of ["dark"]) {
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

const SCENES = { catalogue, builder, stylist, product, hero };
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
