// Captures for the three feature films (src/promo/features/), from the same
// local app as capture/shoot.cjs:
//
//   NODE_PATH=/opt/node-tools/node_modules node capture/shoot-features.cjs [scene …]
//   scenes: morph local colours search
//
// - morph:   the homepage's gooey word (GOO → Outfits → Looks → Style → Fits)
//            recorded frame by frame on the dark hero, in English and Ukrainian.
//            The page's clock is Playwright's: paused, then stepped 1/30 s per
//            frame, so the app's own animation is captured at exactly 30 fps.
// - local:   the phone homepage's "How it works" in English and Ukrainian, its
//            language switch; the featured sneaker's stores in each of the
//            switcher's seven currencies.
// - colours: the phone filter sheet with each colour picked, the results for
//            each colour, the Cities Tee in its eight colours, the sneaker's
//            ten photos.
// - search:  "jacket" typed into the phone search a key at a time, then sorted
//            by price and narrowed to black in the filter sheet.
//
// Phone screens are taken at deviceScaleFactor 3 (the films show them larger
// than the promo did), full screens as JPEG q92, cut-outs as PNG. Geometry goes
// to public/captures/manifest.json under "features".
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { BASE, DESKTOP3, PHONE3, launch, newPage, settle } = require("./browser.cjs");

const OUT = path.join(__dirname, "../public/captures");
const MANIFEST = path.join(OUT, "manifest.json");
const TMP = process.env.FRAMES_DIR ?? path.join(__dirname, "../out/frames");
fs.mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const put = (key, value) => {
  manifest.features ??= {};
  manifest.features[key] = value;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
};

const FEATURED = "6575d398-1a28-4a7a-a1fd-91fad620ef92"; // Air Jordan 1 'Royal', 10 photos
const TEE = "e13fa82f-d245-4267-9e9f-1fba372575ab"; // Purple Brand Cities Tee, 8 colours
const CURRENCIES = ["USD", "EUR", "GBP", "UAH", "CZK", "JPY", "TRY"]; // the switcher's (api/exchange-rates)
const SEARCH = "jacket";

const shot = (name) => path.join(OUT, name);
const jpeg = { type: "jpeg", quality: 92 };
const r2 = (b) => b && { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
/** Rect of the first element matching `sel` (viewport CSS px), or null. */
const rectOf = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; }, sel);

const TABS = "div.md\\:hidden.fixed.inset-x-3";

/** Load every lazy photo and reveal cards, back at the top. */
async function loadAll(page) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((im) => (im.loading = "eager")));
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 250) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
    scrollTo(0, 0);
  });
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("main img")].filter((im) => im.getBoundingClientRect().width > 0);
    await Promise.race([Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })))), new Promise((r) => setTimeout(r, 20000))]);
  });
  await page.waitForTimeout(1000);
}

// ── morph ────────────────────────────────────────────────────────────────────
async function morph(browser) {
  const CLIP = { x: 440, y: 324, width: 560, height: 200 }; // around the word, desktop CSS px
  const entry = { clip: { x: CLIP.x, y: CLIP.y, w: CLIP.width, h: CLIP.height }, fps: 30 };
  for (const lang of ["en", "uk"]) {
    const page = await newPage(browser, DESKTOP3, { theme: "dark", storage: { "goo-lang": lang } });
    await page.clock.install({ time: new Date("2026-10-17T10:00:00Z") });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settle(page, 800);
    // Freeze the CSS background blobs; the word is driven by JS and keeps going.
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }" });
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(new Date(now + 50));
    const state = () => page.evaluate(() => {
      const t = [...document.querySelectorAll("svg text")];
      const shown = t.filter((x) => parseFloat(x.style.opacity || "1") > 0.999 && !x.getAttribute("filter"));
      return { shown: shown.map((x) => x.textContent), filtering: t.some((x) => x.getAttribute("filter")) };
    });
    // Run on until GOO has just settled after the last word melts back into it.
    let wasMorphing = false;
    for (let i = 0; i < 30 * 30; i++) {
      await page.clock.runFor(i % 3 === 2 ? 34 : 33);
      const s = await state();
      if (s.filtering) wasMorphing = true;
      if (wasMorphing && !s.filtering && s.shown.includes("GOO")) {
        const t = await page.evaluate(() => [...document.querySelectorAll("svg text")].map((x) => x.textContent));
        if (t.includes("Fits") || t.includes("Мода")) break;
      }
    }
    // Record one whole cycle from here: GOO holds, then every word in turn.
    const dir = path.join(TMP, `morph-${lang}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const N = 30 * 9;
    const words = [];
    for (let i = 0; i < N; i++) {
      await page.screenshot({ path: path.join(dir, `${String(i).padStart(4, "0")}.png`), clip: CLIP });
      const s = await state();
      words.push(s.filtering ? null : s.shown[0] ?? null);
      await page.clock.runFor(i % 3 === 2 ? 34 : 33);
    }
    const file = `morph-${lang}.mp4`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(dir, "%04d.png"), "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-movflags", "+faststart", shot(file)]);
    // Where each settled word starts holding, for cutting on it.
    const holds = [];
    words.forEach((w, i) => { if (w && w !== words[i - 1]) holds.push({ frame: i, word: w }); });
    entry[lang] = { video: `captures/${file}`, frames: N, holds };
    console.log(`morph ${lang}: ${N} frames, holds`, holds.map((h) => `${h.word}@${h.frame}`).join(" "));
    await page.context().close();
  }
  put("morph", entry);
}

// ── local ────────────────────────────────────────────────────────────────────
async function local(browser) {
  const entry = { size: { w: PHONE3.width, h: PHONE3.height }, home: {}, currency: {} };
  // The phone homepage, two sections, in each language.
  for (const lang of ["en", "uk"]) {
    const page = await newPage(browser, PHONE3, { theme: "light", storage: { "goo-lang": lang } });
    await page.clock.install({ time: new Date("2026-10-17T10:00:00Z") });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await loadAll(page);
    await page.addStyleTag({ content: "*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }" });
    const tops = await page.evaluate(() => [...document.querySelectorAll("[data-home-section], main section")].map((s) => Math.round(s.getBoundingClientRect().top + scrollY)));
    const out = {};
    for (const [name, i] of [["how", 1]]) {
      await page.evaluate((y) => scrollTo(0, y), tops[i]);
      await page.waitForTimeout(700);
      const file = `local-${name}-${lang}.jpg`;
      await page.screenshot({ path: shot(file), ...jpeg });
      out[name] = { image: `captures/${file}`, scroll: tops[i] };
    }
    // The footer's language switch.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(700);
    const sw = await page.evaluate(() => {
      const g = [...document.querySelectorAll("footer button, footer a")].filter((b) => /^(EN|UA)$/.test(b.textContent.trim()));
      const p = g[0]?.parentElement;
      const b = p?.getBoundingClientRect();
      return b && { x: b.left, y: b.top, width: b.width, height: b.height };
    });
    if (sw) {
      const pad = 6;
      const clip = { x: sw.x - pad, y: sw.y - pad, width: sw.width + 2 * pad, height: sw.height + 2 * pad };
      await page.screenshot({ path: shot(`local-switch-${lang}.png`), clip });
      out.switch = { image: `captures/local-switch-${lang}.png`, size: { w: clip.width, h: clip.height } };
    }
    entry.home[lang] = out;
    console.log(`local ${lang}: sections at`, tops.slice(0, 4).join(", "), sw ? "switch ok" : "no switch");
    await page.context().close();
  }
  // The sneaker's page in every currency: its first screen and its stores.
  for (const cur of CURRENCIES) {
    const page = await newPage(browser, PHONE3, { theme: "light", storage: { "goo-currency": cur } });
    await page.goto(BASE + `/product/${FEATURED}`, { waitUntil: "domcontentloaded" });
    await settle(page, 1800);
    const bar = await page.evaluate(() => {
      const bar = document.querySelector('div.md\\:hidden.fixed.inset-x-3');
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
      const ps = bar.querySelectorAll("p");
      return { bar: r(bar), price: r(ps[0]), priceText: ps[0].textContent, stores: ps[1] ? r(ps[1]) : null };
    });
    await page.locator('a[href="#where-to-buy"]').click();
    await page.waitForFunction(() => new Promise((res) => { const y = scrollY; setTimeout(() => res(scrollY === y && y > 0), 1000); }), null, { polling: 100, timeout: 15000 });
    await page.screenshot({ path: shot(`local-${cur}-stores.jpg`), ...jpeg });
    const rows = await page.evaluate(() => {
      const wtb = document.getElementById("where-to-buy");
      return [...wtb.querySelectorAll("div.md\\:hidden > a")].map((a) => {
        const b = a.getBoundingClientRect();
        const price = [...a.querySelectorAll("span, p")].reverse().find((e) => /\d/.test(e.textContent) && e.children.length === 0 && e.getBoundingClientRect().left > b.left + b.width * 0.5);
        const pb = price.getBoundingClientRect();
        return { row: { x: b.left, y: b.top, width: b.width, height: b.height }, price: { x: pb.left, y: pb.top, width: pb.width, height: pb.height }, text: price.textContent };
      });
    });
    entry.currency[cur] = {
      stores: `captures/local-${cur}-stores.jpg`,
      bar: r2(bar.bar),
      price: r2(bar.price),
      priceText: bar.priceText,
      rows: rows.map((x) => ({ row: r2(x.row), price: r2(x.price), text: x.text })),
    };
    console.log(`local ${cur}: ${bar.priceText} | ${rows.map((x) => x.text).join(" / ")}`);
    await page.context().close();
  }
  put("local", entry);
}

// ── colours ──────────────────────────────────────────────────────────────────
async function colours(browser) {
  const groups = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/db/color_groups.json"), "utf8")).sort((a, b) => a.sort_order - b.sort_order);
  const entry = { size: { w: PHONE3.width, h: PHONE3.height }, groups: [], tee: [], gallery: null };

  // The filter sheet, each colour picked in turn.
  {
    const page = await newPage(browser, PHONE3, { theme: "light" });
    await page.goto(BASE + "/browse", { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await page.getByRole("button", { name: "Sort and filter" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: shot("colours-sheet.jpg"), ...jpeg });
    const geo = await page.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
      // The phone's sheet (the desktop drawer is in the page too, hidden).
      const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.getBoundingClientRect().height > 0 && d.getBoundingClientRect().width < 500);
      const sw = [...dlg.querySelectorAll("button[aria-pressed]")].filter((b) => b.querySelector("span.rounded-full") && b.getBoundingClientRect().width > 0);
      const show = [...dlg.querySelectorAll("button")].find((b) => /^Show \d+ piece/.test(b.textContent.trim()));
      return { swatches: sw.map((b) => ({ name: b.getAttribute("aria-label"), rect: r(b) })), show: r(show), sheet: r(dlg) };
    });
    // The colour row and the button, cut out once per colour.
    const xs = geo.swatches.map((s) => s.rect);
    const row = { x: Math.min(...xs.map((r) => r.x)) - 4, y: Math.min(...xs.map((r) => r.y)) - 4 };
    row.width = Math.max(...xs.map((r) => r.x + r.width)) + 4 - row.x;
    row.height = Math.max(...xs.map((r) => r.y + r.height)) + 4 - row.y;
    const showClip = { x: geo.show.x - 4, y: geo.show.y - 4, width: geo.show.width + 8, height: geo.show.height + 8 };
    for (const g of groups) {
      const btn = page.getByRole("dialog").getByRole("button", { name: g.name, exact: true });
      if (!(await btn.count())) { console.log(`colours: no swatch for ${g.name}`); continue; }
      await btn.click();
      await page.waitForTimeout(900);
      const showText = (await page.getByRole("dialog").getByRole("button", { name: /^Show \d+ piece/ }).textContent()).trim();
      await page.screenshot({ path: shot(`colours-row-${g.name.toLowerCase()}.png`), clip: row });
      await btn.click();
      await page.waitForTimeout(500);
      entry.groups.push({ name: g.name, hex: g.hex_code, show: showText, row: `captures/colours-row-${g.name.toLowerCase()}.png` });
    }
    await page.screenshot({ path: shot("colours-row-none.png"), clip: row });
    entry.sheet = { image: "captures/colours-sheet.jpg", row: r2(row), show: r2(showClip), swatches: geo.swatches.map((s) => ({ name: s.name, rect: r2(s.rect) })), rect: r2(geo.sheet), rowNone: "captures/colours-row-none.png" };
    console.log(`colours sheet: ${entry.groups.map((g) => `${g.name} ${g.show}`).join(", ")}`);
    await page.context().close();
  }

  // The results for each colour.
  for (const g of entry.groups) {
    const page = await newPage(browser, PHONE3, { theme: "light" });
    await page.goto(BASE + `/browse?color=${encodeURIComponent(g.name)}`, { waitUntil: "domcontentloaded" });
    await settle(page, 1800);
    await page.waitForTimeout(600);
    const file = `colours-grid-${g.name.toLowerCase()}.jpg`;
    await page.screenshot({ path: shot(file), ...jpeg });
    g.grid = `captures/${file}`;
    await page.context().close();
  }
  console.log(`colours: ${entry.groups.length} grids`);

  entry.tee = await tee(browser);

  // The sneaker's photos, one by one, as the phone swipes through them.
  {
    const page = await newPage(browser, PHONE3, { theme: "light" });
    await page.goto(BASE + `/product/${FEATURED}`, { waitUntil: "domcontentloaded" });
    await settle(page, 1500);
    await page.evaluate(() => document.querySelectorAll("img").forEach((im) => (im.loading = "eager")));
    const geo = await page.evaluate(() => {
      const sc = [...document.querySelectorAll("main div")].find((d) => getComputedStyle(d).scrollSnapType.includes("x") && d.scrollWidth > d.clientWidth);
      sc.setAttribute("data-cap-slides", "");
      let card = sc;
      while (card.parentElement && card.parentElement.getBoundingClientRect().height < card.getBoundingClientRect().height + 80 && card.parentElement.tagName !== "MAIN") card = card.parentElement;
      const b = card.getBoundingClientRect();
      return { n: Math.round(sc.scrollWidth / sc.clientWidth), card: { x: b.left, y: b.top, width: b.width, height: b.height } };
    });
    const files = [];
    for (let i = 0; i < geo.n; i++) {
      await page.evaluate((i) => { const sc = document.querySelector("[data-cap-slides]"); sc.style.scrollBehavior = "auto"; sc.scrollLeft = i * sc.clientWidth; sc.dispatchEvent(new Event("scroll")); }, i);
      await page.waitForTimeout(700);
      await page.evaluate(async () => { const imgs = [...document.querySelectorAll("[data-cap-slides] img")]; await Promise.race([Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })))), new Promise((r) => setTimeout(r, 8000))]); });
      const file = `colours-photo-${String(i + 1).padStart(2, "0")}.jpg`;
      await page.screenshot({ path: shot(file), clip: geo.card, ...jpeg });
      files.push(`captures/${file}`);
    }
    entry.gallery = { card: r2(geo.card), photos: files };
    console.log(`colours gallery: ${files.length} photos`);
    await page.context().close();
  }
  put("colours", entry);
}

// The Cities Tee, in each of its colours (each colour is its own page, linked
// from the swatches under the name).
async function tee(browser) {
  const out = [];
  const page = await newPage(browser, PHONE3, { theme: "light" });
  await page.goto(BASE + `/product/${TEE}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  const variants = await page.evaluate(() => [...document.querySelectorAll('main a[aria-label^="View in "]')].filter((a) => a.getBoundingClientRect().width > 0).map((a) => ({ id: a.getAttribute("href").split("/").pop(), name: a.getAttribute("aria-label").replace("View in ", "") })));
  await page.context().close();
  for (const v of variants) {
    const p = await newPage(browser, PHONE3, { theme: "light" });
    await p.goto(BASE + `/product/${v.id}`, { waitUntil: "domcontentloaded" });
    await settle(p, 1500);
    const file = `colours-tee-${v.name.toLowerCase().replace(/\W+/g, "-")}.jpg`;
    await p.screenshot({ path: shot(file), ...jpeg });
    const geo = await p.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
      const sw = [...document.querySelectorAll('main a[aria-label^="View in "]')].filter((a) => a.getBoundingClientRect().width > 0);
      const cur = sw.find((a) => a.getAttribute("aria-current") === "page");
      const photo = [...document.querySelectorAll("main img")].map((i) => i.closest("div.rounded-2xl, div.rounded-3xl, div[class*='rounded']")).find((d) => d && d.getBoundingClientRect().width > 300);
      return { swatches: sw.map(r), current: sw.indexOf(cur), hex: cur ? getComputedStyle(cur.querySelector("span")).backgroundColor : null, photo: photo ? r(photo) : null };
    });
    out.push({ id: v.id, name: v.name, image: `captures/${file}`, swatches: geo.swatches.map(r2), current: geo.current, color: geo.hex, photo: r2(geo.photo) });
    await p.context().close();
  }
  console.log(`colours tee: ${out.map((t) => `${t.name} ${t.color}`).join(", ")}`);
  return out;
}

async function teeOnly(browser) {
  const entry = manifest.features.colours;
  entry.tee = await tee(browser);
  put("colours", entry);
}

// ── search ───────────────────────────────────────────────────────────────────
async function search(browser) {
  const entry = { size: { w: PHONE3.width, h: PHONE3.height }, query: SEARCH, typed: [] };
  const page = await newPage(browser, PHONE3, { theme: "light" });
  await page.goto(BASE + "/browse", { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  await loadAll(page);
  await page.screenshot({ path: shot("search-0.jpg"), ...jpeg });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForTimeout(700);
  const bar = await page.evaluate(() => { const i = document.querySelector('input[aria-label^="Search"]'); let b = i; while (b.parentElement && b.getBoundingClientRect().width < 300) b = b.parentElement; const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  const cards = () => page.evaluate(() => {
    const grid = [...document.querySelectorAll("main div.grid")].find((g) => g.offsetParent && g.querySelector('a[href^="/product/"]'));
    if (!grid) return [];
    return [...grid.children].map((c) => { const b = c.getBoundingClientRect(); return { href: c.querySelector('a[href^="/product/"]')?.getAttribute("href"), x: b.left, y: b.top + scrollY, w: b.width, h: b.height }; });
  });
  const countText = () => page.evaluate(() => (document.body.innerText.match(/\d+ pieces? for “[^”]*”/) || [null])[0]);
  for (let i = 0; i <= SEARCH.length; i++) {
    if (i > 0) await page.keyboard.type(SEARCH[i - 1]);
    await page.waitForTimeout(i === 0 ? 300 : 900);
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((im) => (im.loading = "eager")));
    await settle(page, 300);
    const file = `search-type-${i}.jpg`;
    await page.screenshot({ path: shot(file), ...jpeg });
    entry.typed.push({ image: `captures/${file}`, chars: i, count: await countText() });
  }
  entry.bar = r2(bar);
  // The results as typed, then as sorted by price, then narrowed to black.
  const state = async (name) => {
    await loadAll(page);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    const file = `search-${name}.jpg`;
    await page.screenshot({ path: shot(file), ...jpeg });
    const full = `search-${name}-full.jpg`;
    const tag = await page.addStyleTag({ content: `${TABS} { visibility: hidden !important; }` });
    await page.screenshot({ path: shot(full), fullPage: true, ...jpeg });
    await tag.evaluate((t) => t.remove());
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    return { image: `captures/${file}`, full: `captures/${full}`, height: h, cards: (await cards()).map((c) => ({ href: c.href, rect: { x: c.x, y: c.y, w: c.w, h: c.h } })), count: await countText() };
  };
  // Search mode has no filter button: the same results, opened from the
  // address (/browse?search=jacket), carry the toolbar with the sheet.
  await page.goto(BASE + `/browse?search=${SEARCH}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  entry.listed = await state("listed");
  await page.getByRole("button", { name: /^Sort and filter/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot("search-sheet.jpg"), ...jpeg });
  const chip = page.getByRole("dialog").getByRole("button", { name: "Price: low to high" });
  const chipRect = await chip.boundingBox();
  await chip.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: shot("search-sheet-sorted.jpg"), ...jpeg });
  const black = page.getByRole("dialog").getByRole("button", { name: "Black", exact: true });
  const blackRect = await black.boundingBox();
  const showRect = await page.getByRole("dialog").getByRole("button", { name: /^Show \d+ piece/ }).boundingBox();
  const showBefore = await page.getByRole("dialog").getByRole("button", { name: /^Show \d+ piece/ }).textContent();
  // Sorted first, on its own.
  await page.getByRole("dialog").getByRole("button", { name: /^Show \d+ piece/ }).click();
  await page.waitForTimeout(900);
  entry.sorted = await state("sorted");
  await page.getByRole("button", { name: /^Sort and filter/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(900);
  await black.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot("search-sheet-black.jpg"), ...jpeg });
  const showAfter = await page.getByRole("dialog").getByRole("button", { name: /^Show \d+ piece/ }).textContent();
  await page.getByRole("dialog").getByRole("button", { name: /^Show \d+ piece/ }).click();
  await page.waitForTimeout(900);
  entry.black = await state("black");
  entry.sheet = {
    open: "captures/search-sheet.jpg",
    sorted: "captures/search-sheet-sorted.jpg",
    black: "captures/search-sheet-black.jpg",
    chip: r2({ x: chipRect.x, y: chipRect.y, width: chipRect.width, height: chipRect.height }),
    swatch: r2({ x: blackRect.x, y: blackRect.y, width: blackRect.width, height: blackRect.height }),
    show: r2({ x: showRect.x, y: showRect.y, width: showRect.width, height: showRect.height }),
    showBefore: showBefore.trim(),
    showAfter: showAfter.trim(),
  };
  console.log(`search: ${entry.typed.map((t) => t.count).join(" | ")}; sorted ${entry.sorted.cards.length} cards; ${entry.sheet.showBefore} → ${entry.sheet.showAfter}`);
  await page.context().close();
  put("search", entry);
}

const SCENES = { morph, local, colours, search, tee: teeOnly };
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
