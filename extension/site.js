/**
 * The whole store: every category its menu offers, then its sitemaps.
 *
 * "Collect this page" walks one listing. A store of six hundred thousand
 * pieces is hundreds of listings, and the admin asked for all of them without
 * opening each by hand. So the run reads the store's own menu for its
 * categories, walks each one the way "Collect this page" walks a listing
 * (listing.js), and opens every piece it finds once, however many categories
 * show it: "New in", "Jackets" and "Sale" share most of their cards. Last come
 * the store's sitemaps, for the pieces no menu category led to.
 *
 * A run like that takes days, so it is written down as it goes: which
 * categories there are, which one it is on and on which page, and every piece
 * already opened. Stop, a store that refuses twice, Chrome restarting: Resume
 * carries on from there and opens nothing twice.
 *
 * Nothing here decides what a product is. The planner on the server still
 * does, from the links each walk hands it. This module decides what is worth
 * walking: the store's own categories, in the language the admin is browsing
 * in, and not its cart, its help pages or its blog.
 */

// ── Reading the menu (runs in the page) ──────────────────────────────────────

/**
 * Every link on the store's page, with where it sits: in the menu, in the
 * footer, or in the page itself.
 *
 * Handed to `chrome.scripting.executeScript` as `func`, so it stands alone.
 * Mega-menus keep their links in the page while they are closed, hidden but
 * present, so they are read with `textContent` rather than `innerText`, which
 * is empty for anything not on screen.
 */
export async function menuStep(options = {}) {
  const host = location.hostname.replace(/^www\./, "");
  const NAV =
    'header, nav, [role="navigation"], [role="menubar"], [role="menu"], [role="banner"]';
  const FOOT = 'footer, [role="contentinfo"]';
  // Class names and ids that mark a menu on stores without the landmarks:
  // `site-header__nav`, `mega-menu`, `MenuDrawer`, `category-list`.
  const NAVISH = /(?:^|[\s_-])(?:menu|menus|nav|navbar|navigation|megamenu|mega|drawer|header|catalog|categories|category-list)(?:$|[\s_-]|[A-Z])/i;

  const where = (a) => {
    if (a.closest(FOOT)) return "footer";
    if (a.closest(NAV)) return "menu";
    for (let el = a.parentElement; el && el !== document.body; el = el.parentElement) {
      const name = `${typeof el.className === "string" ? el.className : ""} ${el.id || ""}`;
      if (NAVISH.test(name)) return "menu";
    }
    return "page";
  };

  /**
   * An element's own words: its text, without the CSS, scripts and icon
   * titles some stores keep inside a link. Nike's said
   * `.css-101v3r5{font:var(--podium-cds-typography…` before "Sale".
   */
  const SKIP_TEXT = "script, style, template, noscript, svg";
  /**
   * Words kept for screen readers only. A menu's toggles carry them ("Expand
   * child menu", "Menu Toggle", "Show sub menu" in WordPress themes), and
   * read as a heading they named a folder "child".
   */
  const OFF_SCREEN = ".screen-reader-text, .sr-only, .visually-hidden, .visuallyhidden, .sr-only-focusable, .a11y-hidden, .u-hidden-visually";
  const words = (el, max = 80, onScreen = false) => {
    const parts = [];
    let size = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && size <= max; node = walker.nextNode()) {
      const skip = node.parentElement && node.parentElement.closest(SKIP_TEXT);
      if (skip && el.contains(skip)) continue;
      const unseen = onScreen && node.parentElement && node.parentElement.closest(OFF_SCREEN);
      if (unseen && unseen !== el && el.contains(unseen)) continue;
      const t = node.nodeValue.replace(/\s+/g, " ").trim();
      if (t) {
        parts.push(t);
        size += t.length + 1;
      }
    }
    return parts.join(" ").slice(0, max);
  };
  const labelOf = (a) =>
    ((a.getAttribute("aria-label") || "").trim() || words(a) || a.getAttribute("title") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

  // ── Where in the menu a link sits ──────────────────────────────────────────
  //
  // A store's menu is a tree: Men › Clothes › Coats, Children › Girls › View
  // All. Read as a flat list, a dozen links are called "View All" and nobody
  // can tell which is whose. So each link is given the names of the groups
  // around it, outermost first, read off the markup the way a person reads
  // the open menu: the tab it hangs under, the column heading above it.
  //
  // Up from the link to the edge of the menu, each element can be named by
  //   - `aria-labelledby`, a `<details>`' summary, or the control that opens
  //     it from elsewhere: by `aria-controls`, by a `data-*` value the two
  //     share (Kith), or as the n-th tab of a list whose panels sit, in the
  //     same order, in another (`tabOf`). The trail then goes on above the
  //     control;
  //   - the heading before it: the nearest earlier sibling with a few words of
  //     its own, a heading, a button, a label or a single link ("Men" before
  //     its panel, "Clothes" before its list), up to a divider, and not one
  //     more item of the same list, not a column of links, not a control that
  //     opens a panel of its own, not a promotion, an announcement, the logo,
  //     "‹ Back" or a toggle's screen-reader words. A list's first item set
  //     apart by its markup heads the rest only inside a submenu (Burberry's
  //     columns), never in the menu's top bar (a highlighted "Sale").
  // No group found is no group: the link stands at the top of the tree, and
  // the store's addresses may still group it (`menuGroups`). Everything read
  // is kept per element, so a flat menu of thousands of links stays quick.

  /** Where a group's name stops being the menu's and starts being the page's. */
  const EDGE =
    'nav, header, footer, aside, dialog, [role="navigation"], [role="menubar"], [role="banner"], [role="contentinfo"], [role="dialog"]';
  const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"], dt, summary, legend, caption, label, button, [aria-expanded], [aria-haspopup]';
  const HEADING_INSIDE = 'h1, h2, h3, h4, h5, h6, [role="heading"], strong, b';
  /** What says it is a heading and nothing else. */
  const TRUE_HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"], dt, summary, legend, caption, label';
  /** Class names a heading goes by when the markup does not say: `menu__title`, `nav-heading`, `groupLabel`. */
  const HEADISH = /(?:^|[\s_-])(?:head|header|heading|headline|title|label|caption|group-?title|section-?title)(?:$|[\s_-]|[A-Z])/i;
  /** Words that head nothing: the menu's own controls. */
  const NOT_A_GROUP =
    /^(?:skip to\b.*|(?:go )?back(?: to\b.*)?|zurück|назад|retour|atrás|volver|indietro|terug|wstecz|tillbaka|close|close menu|open menu|menu|main menu|navigation|main navigation|toggle navigation|search|account|my account|sign in|log in|cart|bag|basket|wishlist|more|see more|show more|view more|less|all|(?:view|shop|see|show|explore|discover) all\b.*|©.*|.*\ball rights reserved\b.*)$/i;
  /** A submenu's toggle, read before its words are tidied: "Expand child menu" is not "child". */
  const TOGGLE =
    /^(?:(?:expand|collapse|show|hide|toggle|open|close)(?: the)?(?: child| sub| sub-| sub ?)?(?: ?menu| ?navigation| ?nav| ?dropdown| ?items?)?|(?:sub ?|sub-)?menu toggle|toggle|child|sub|submenu|dropdown)$/i;
  /** Words an announcement or a promotion says, not a shelf: "Free UK delivery over £50", "USE CODE APP15". */
  const PROMO = /[%$€£¥₴!?]|\b(?:free|off|code|delivery|shipping|returns|order|orders|sign up|newsletter|download)\b/i;
  /** An item marked as the page the admin is on: styled apart, but not a heading. */
  const CURRENT = /(?:^|[\s_-])(?:active|current|selected)(?:$|[\s_-])/i;
  const MAX_GROUP = 60;
  const MAX_DEPTH = 5;

  let linksIn = new WeakMap();
  const linkCount = (el) => {
    let n = linksIn.get(el);
    if (n === undefined) {
      n = (el.matches("a[href]") ? 1 : 0) + el.querySelectorAll("a[href]").length;
      linksIn.set(el, n);
    }
    return n;
  };
  const classOf = (el) => `${typeof el.className === "string" ? el.className : ""}`;
  /** A link to the store's home page: its logo or its name, which heads nothing. */
  const isHome = (el) => {
    const a = el.matches("a[href]") ? el : el.querySelector("a[href]");
    if (!a) return false;
    // `href="#"` is a toggle's, whatever page it is on.
    const href = (a.getAttribute("href") || "").trim();
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return false;
    try {
      const u = new URL(href, document.baseURI);
      return u.hostname.replace(/^www\./, "") === host && /^\/(?:[a-z]{2}(?:[-_][a-z]{2,4})?\/?)?$/i.test(u.pathname);
    } catch {
      return false;
    }
  };
  /** A few words that could head something: one link at most, no list, no picture, no logo. */
  let headWordsOf = new WeakMap();
  const headWords = (el) => {
    let t = headWordsOf.get(el);
    if (t !== undefined) return t;
    t = "";
    if (linkCount(el) <= 1 && !el.querySelector("ul, ol, img, picture, video, [role='menu'], [role='list']") && !isHome(el)) {
      // The words the admin sees in the store's menu; a label only for an icon.
      const raw = words(el, MAX_GROUP + 12, true) || (el.getAttribute("aria-label") || "").trim();
      t = groupName(raw);
      // An announcement is not a heading, unless the markup says it is one.
      if (t && (PROMO.test(raw) || t.split(" ").length > 6) && !el.matches(TRUE_HEADING)) t = "";
    }
    headWordsOf.set(el, t);
    return t;
  };
  /**
   * A group's name as the menu reads it, or "": Nike's "Men menu" is Men,
   * END.'s "Open Men :: Subnav" is Men.
   */
  const groupName = (text) => {
    // "‹ Back", "← Back", "Women ›": the arrows are the menu's, not the name's.
    const raw = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "");
    if (TOGGLE.test(raw)) return "";
    const t = raw
      .replace(/^(?:open|show|toggle|expand)\s+/i, "")
      .replace(/(?:\s*(?:::|[|–—-])?\s*(?:menu|navigation|nav|subnav|submenu|sub-menu|dropdown))+$/i, "")
      .trim();
    return t && t.length <= MAX_GROUP && !NOT_A_GROUP.test(t) ? t : "";
  };
  /**
   * An element's markup, short: its tag and classes and those of its first
   * children. Items of one list share it; a heading set as the list's first
   * item usually does not (Burberry: `li > a > span._navContentL2` heads
   * the `li > a > span._navContentL3` under it).
   */
  let shapes = new WeakMap();
  const shapeOf = (el) => {
    let shape = shapes.get(el);
    if (shape === undefined) {
      shape = "";
      for (let n = el, d = 0; n && d < 4; n = n.firstElementChild, d++) shape += `>${n.tagName}.${classOf(n)}`;
      shapes.set(el, shape);
    }
    return shape;
  };
  const isCurrent = (el) => {
    for (let n = el, d = 0; n && d < 4; n = n.firstElementChild, d++) {
      if (n.hasAttribute("aria-current") || CURRENT.test(classOf(n))) return true;
    }
    return false;
  };
  /**
   * A list's children by their markup, counted once per list: how many share
   * each, and which come twice in a row. Counted afresh for every item, a
   * flat menu of 5,000 links (WooCommerce, Magento) took minutes.
   */
  let listStats = new WeakMap();
  const statsOf = (parent) => {
    let stats = listStats.get(parent);
    if (!stats) {
      stats = { count: new Map(), twice: new Set() };
      let last = "";
      for (const c of parent.children) {
        const shape = shapeOf(c);
        stats.count.set(shape, (stats.count.get(shape) || 0) + 1);
        if (shape === last) stats.twice.add(shape);
        last = shape;
      }
      listStats.set(parent, stats);
    }
    return stats;
  };
  /** How many of an element's siblings, itself included, share its markup. */
  const alike = (el) => (el.parentElement ? statsOf(el.parentElement).count.get(shapeOf(el)) || 0 : 0);
  let nested = new WeakMap();
  /** Is this list a submenu inside another item, rather than the menu's top bar? */
  const isSubmenu = (list) => {
    let yes = nested.get(list);
    if (yes === undefined) {
      yes = !!(list.parentElement && list.parentElement.closest('li, [role="menuitem"]'));
      nested.set(list, yes);
    }
    return yes;
  };
  /**
   * Is `s` set apart as the heading of the items after it, as Burberry sets
   * its column headings? It is rarer than they are, each of them is one link,
   * it never comes twice in a row (a list of links and buttons mixed, as in
   * Kith's drawer, is not headings and items), the list is a submenu inside
   * another item, not the menu's top bar, and a heading that comes once comes
   * first: a highlighted "Sale" halfway along the bar heads nothing.
   */
  const setApart = (s, child) => {
    if (linkCount(child) !== 1 || linkCount(s) > 1) return false;
    const list = s.parentElement;
    if (!list || !isSubmenu(list)) return false;
    if (alike(child) < 2 || alike(s) >= alike(child)) return false;
    if (statsOf(list).twice.has(shapeOf(s))) return false;
    return alike(s) > 1 || list.firstElementChild === s;
  };
  /**
   * What an element is, read once: a menu reads each of its items as the
   * sibling before dozens of others, and asking the markup again for each
   * made a flat menu of thousands slow.
   */
  let traitsOf = new WeakMap();
  const traits = (el) => {
    let t = traitsOf.get(el);
    if (!t) {
      const inside = !!el.querySelector(HEADING_INSIDE);
      t = {
        current: isCurrent(el),
        // An item that is a button opens a list of its own somewhere else
        // (Kith's drawer: "Footwear ›"); it heads nothing after it.
        button: !!el.querySelector(OPENER) && !inside,
        // Says it is a heading: the tag, a bold title inside, a heading's class, or words without a link.
        heading: el.matches(HEADING) || inside || HEADISH.test(`${classOf(el)} ${el.id || ""}`) || linkCount(el) === 0,
        divider: isDivider(el),
      };
      traitsOf.set(el, t);
    }
    return t;
  };
  /** Does `s`, before `child` in one list, head it rather than being one more item? */
  const heads = (s, child) => {
    // Nothing heads its own kind: tabs in a row, headings in a row. Nor does
    // the item for the page the admin is on, however bold.
    const t = traits(s);
    if (shapeOf(s) === shapeOf(child) || t.current || t.button) return false;
    return t.heading || setApart(s, child);
  };

  /**
   * Controls that open a part of the menu, and what they name it by. A panel
   * can be anywhere in the markup: Kith keeps "Footwear ›" in one list and
   * its links in another, the two sharing only `data-id`. So every value of
   * an opener's `aria-controls`, `href="#…"` and `data-*` is noted, and a
   * part of the menu whose `id` or `data-*` carries one of them is that
   * opener's. A value two openers share names neither.
   */
  const OPENER = 'button, [role="button"], [role="tab"], [aria-expanded], [aria-haspopup], summary, a[href^="#"]';
  let openers = null;
  const tokensOf = (el) => {
    const out = [];
    for (const attr of el.attributes) {
      const name = attr.name;
      if (name !== "id" && name !== "aria-controls" && name !== "href" && !name.startsWith("data-")) continue;
      for (let v of attr.value.split(/\s+/)) {
        v = v.replace(/^#/, "");
        if (name === "href" && !attr.value.startsWith("#")) continue;
        // Values worth matching: not a number, not a flag, long enough to mean one thing.
        if (v.length < 3 || /^\d+$/.test(v) || /^(?:true|false|null|none|open|closed|hidden)$/i.test(v)) continue;
        // A `data-*` value must look like a name for one thing (`mens-footwear`),
        // not a behaviour every toggle shares (`dropdown`, `collapse`).
        if (name.startsWith("data-") && !/[-_:.\d]/.test(v)) continue;
        out.push(v);
      }
    }
    return out;
  };
  const openerOf = (el) => {
    if (!openers) {
      openers = new Map();
      for (const o of document.querySelectorAll(OPENER)) {
        for (const v of tokensOf(o)) openers.set(v, openers.has(v) && openers.get(v) !== o ? null : o);
      }
    }
    for (const v of tokensOf(el)) {
      const o = openers.get(v);
      if (o && o !== el && !o.contains(el) && !el.contains(o)) return o;
    }
    return null;
  };
  /**
   * Tabs in one list and their panels in another, in the same order and
   * nothing else joining them: the third panel is the third tab's. Only when
   * the box holds panels and nothing else, as many as the list has tabs, and
   * they look like a menu's panels (tabs that are buttons, panels hidden or
   * named so); a row of footer links over footer columns is no such thing.
   */
  const PANELISH = /(?:^|[\s_-])(?:mega|panel|panels|dropdown|flyout|submenu|sub-menu|subnav|tabpanel)(?:$|[\s_-]|[A-Z])/i;
  const itemsOf = (list) => {
    for (let l = list, d = 0; l && d < 2; l = l.children.length === 1 ? l.firstElementChild : null, d++) {
      const kids = [...l.children];
      if (kids.length >= 2 && kids.every((k) => shapeOf(k) === shapeOf(kids[0]))) return kids;
    }
    return null;
  };
  const isHidden = (el) => el.hidden || el.getAttribute("aria-hidden") === "true" || getComputedStyle(el).display === "none";
  /** Each box of panels, read once: its panels and their tabs, or null. */
  let tabsOf = new WeakMap();
  const tabOf = (panel) => {
    const box = panel.parentElement;
    if (!box || box.children.length < 2 || linkCount(panel) < 1) return null;
    if (!tabsOf.has(box)) {
      let found = null;
      const panels = [...box.children];
      if (panels.every((p) => shapeOf(p) === shapeOf(panel))) {
        for (let s = box.previousElementSibling, n = 0; s && n < 3; s = s.previousElementSibling, n++) {
          const tabs = itemsOf(s);
          if (!tabs || tabs.length !== panels.length || !tabs.every((t) => linkCount(t) <= 1 && headWords(t))) continue;
          const menuish =
            tabs.some((t) => t.matches(OPENER) || t.querySelector(OPENER)) ||
            panels.filter(isHidden).length >= panels.length - 1 ||
            PANELISH.test(`${classOf(panel)} ${classOf(box)}`);
          if (menuish) found = new Map(panels.map((p, i) => [p, tabs[i]]));
          break;
        }
      }
      tabsOf.set(box, found);
    }
    const found = tabsOf.get(box);
    return (found && found.get(panel)) || null;
  };
  /** A line between parts of a list: `<hr>`, Bootstrap's `.dropdown-divider`, `li > hr`. */
  const isDivider = (el) =>
    el.matches('hr, [role="separator"]') ||
    /(?:^|[\s_-])(?:divider|separator)(?:$|[\s_-])/i.test(classOf(el)) ||
    (el.children.length === 1 && !el.textContent.trim() && el.firstElementChild.matches('hr, [role="separator"]'));
  /** Is `s` a control for a panel other than `child`? */
  const opensElsewhere = (s, child) => {
    const own = s.matches(OPENER) ? s : s.children.length === 1 && s.firstElementChild.matches(OPENER) ? s.firstElementChild : null;
    if (!own) return false;
    const controls = (own.getAttribute("aria-controls") || "").split(/\s+/).filter(Boolean);
    if (controls.length) return !controls.some((id) => id === child.id || (child.querySelector && child.querySelector(`[id="${id.replace(/"/g, "")}"]`)));
    // Kith: the panel is found by a value they share, and it is not this one.
    openerOf(child);
    const shared = tokensOf(own).filter((v) => v !== own.id && openers.get(v) === own);
    return shared.length > 0 && !tokensOf(child).some((v) => shared.includes(v));
  };
  const named = (ids) =>
    ids
      .split(/\s+/)
      .map((id) => (id ? document.getElementById(id) : null))
      .filter(Boolean)
      .map((x) => words(x, MAX_GROUP + 1))
      .join(" ")
      .trim();

  /**
   * The name of the group `child` opens within its parent, or "". A link is
   * named by its own words, so of a link only the heading before it counts.
   */
  let groupNames = new WeakMap();
  const groupOf = (child) => {
    if (groupNames.has(child)) return groupNames.get(child);
    let found = "";
    /** The control that opens this part of the menu from elsewhere: the trail goes on above it. */
    let from = null;
    const isLink = child.matches("a[href]");
    const labelledBy = !isLink && child.getAttribute("aria-labelledby");
    if (labelledBy) {
      found = groupName(named(labelledBy));
      const label = found ? document.getElementById(labelledBy.split(/\s+/)[0]) : null;
      if (label && !child.contains(label)) from = label;
    }
    if (!found && child.tagName === "DETAILS") {
      const summary = child.querySelector(":scope > summary");
      if (summary) found = headWords(summary);
    }
    if (!found && !isLink) {
      const opener = openerOf(child) || tabOf(child);
      if (opener) {
        found = headWords(opener);
        if (found) from = opener;
      }
    }
    if (!found) {
      // A control that opens a panel is an item of its list: only a heading,
      // not the link beside it, heads it ("New In" before the "Women" tab).
      // (A panel that says `aria-expanded` itself, as jQuery UI's do, is a panel.)
      const opener =
        child.matches(OPENER) &&
        !child.matches('ul, ol, [role="menu"], [role="menubar"], [role="list"], [role="group"]') &&
        linkCount(child) <= 1 &&
        !child.querySelector("ul, ol");
      let n = 0;
      for (let s = child.previousElementSibling; s && n < 60; s = s.previousElementSibling, n++) {
        // One more item of the same kind: never its heading, and cheap to pass.
        if (shapeOf(s) === shapeOf(child)) continue;
        // A divider ends the part of the list a heading heads.
        if (traits(s).divider) break;
        // A tab or a toggle that opens a panel of its own heads that panel only.
        if (opensElsewhere(s, child)) continue;
        const t = headWords(s);
        if (!t) {
          // A column of links before this one: the column has no heading of its own.
          if (linkCount(s) > 1) break;
          continue;
        }
        if (opener && !s.matches(TRUE_HEADING) && !s.querySelector(HEADING_INSIDE) && !HEADISH.test(`${classOf(s)} ${s.id || ""}`)) continue;
        // One more item of the same list, not its heading.
        if (s.tagName === child.tagName && !heads(s, child)) continue;
        found = t;
        break;
      }
    }
    const group = { name: found, from };
    groupNames.set(child, group);
    return group;
  };
  /** The menu's edge above a link: its landmark, else its outermost menu-ish container. */
  const edgeOf = (a) => {
    const landmark = a.closest(EDGE);
    if (landmark) return landmark;
    let top = null;
    for (let el = a.parentElement; el && el !== document.body; el = el.parentElement) {
      if (NAVISH.test(`${classOf(el)} ${el.id || ""}`)) top = el;
    }
    return top;
  };
  /** The groups a link sits in, outermost first. */
  const trailOf = (a) => {
    let edge = edgeOf(a);
    if (!edge) return [];
    const trail = [];
    const been = new Set();
    for (let child = a; child && !been.has(child) && trail.length < MAX_DEPTH; ) {
      been.add(child);
      const { name, from } = groupOf(child);
      if (name && (!trail.length || trail[0].toLowerCase() !== name.toLowerCase())) trail.unshift(name);
      if (from) {
        // Opened from elsewhere: what holds the opener holds this too.
        child = from;
        edge = edgeOf(from) || edge;
        continue;
      }
      const el = child.parentElement;
      if (!el || el === edge || el === document.body) break;
      child = el;
    }
    return trail;
  };

  /** What is read of the markup is kept per element; the markup is new once a menu has opened. */
  const forget = () => {
    linksIn = new WeakMap();
    headWordsOf = new WeakMap();
    shapes = new WeakMap();
    listStats = new WeakMap();
    nested = new WeakMap();
    traitsOf = new WeakMap();
    tabsOf = new WeakMap();
    groupNames = new WeakMap();
    openers = null;
  };

  /**
   * Every link of the page as it stands now, with where it sits and the
   * groups around it; with `looking`, also whether it is on screen.
   */
  const readNow = (looking = false) => {
    forget();
    const links = [];
    const roots = [document];
    for (let i = 0; i < roots.length && i < 2000 && links.length < 5000; i++) {
      for (const a of roots[i].querySelectorAll("a[href]")) {
        let url;
        try {
          const u = new URL(a.getAttribute("href"), document.baseURI);
          if (u.protocol !== "http:" && u.protocol !== "https:") continue;
          if (u.hostname.replace(/^www\./, "") !== host) continue;
          u.hash = "";
          url = u.href;
        } catch {
          continue;
        }
        const place = where(a);
        const link = { url, label: labelOf(a), where: place, trail: place === "page" ? [] : trailOf(a) };
        if (looking) link.shown = shown(a);
        links.push(link);
        if (links.length >= 5000) break;
      }
      for (const el of roots[i].querySelectorAll("*")) if (el.shadowRoot) roots.push(el.shadowRoot);
    }
    return links;
  };

  // ── Opening the menu ────────────────────────────────────────────────────────
  //
  // Many stores keep a mega-menu's panels in the page only while it is open.
  // Burberry renders them all with the page, and takes them all away the
  // first time the pointer has been over the menu and left: an admin who had
  // looked at "Men" before pressing the button got seven categories, and no
  // folder in them. So the menu bar's items are opened one by one, the way a
  // pointer opens them (pointer and mouse events; a click only for a button
  // that says it opens something), and the menu is read while each is open.
  // A link is never clicked: the tab must stay where it is.

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /**
   * Watch the page from now on; `settled(quiet, most)` then waits until it
   * has stopped changing for a moment, or long enough, and says whether it
   * changed. Watching starts before the menu is opened: a page may redraw
   * in the very handler of the event.
   */
  const watch = () => {
    let changed = false;
    let kick = () => {};
    const observer = new MutationObserver(() => {
      changed = true;
      kick();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-expanded", "aria-hidden"] });
    const settled = (quiet, most) =>
      new Promise((done) => {
        let timer = 0;
        const end = () => {
          observer.disconnect();
          clearTimeout(timer);
          clearTimeout(cap);
          done(changed);
        };
        kick = () => {
          clearTimeout(timer);
          timer = setTimeout(end, quiet);
        };
        timer = setTimeout(end, changed ? quiet : quiet * 2);
        const cap = setTimeout(end, most);
      });
    return settled;
  };
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  /**
   * The menu bar's items worth opening: on screen in the page's menu, a few
   * words each. First those that say they open something (`aria-haspopup`,
   * `aria-expanded`, `aria-controls`, a button, a tab), then a few plain
   * links along the top of the page, for menus that open on hover and say
   * nothing. Opening an item that opens nothing costs half a second.
   */
  const barItems = () => {
    const says = [];
    const plain = [];
    const seen = new Set();
    for (const root of document.querySelectorAll(NAV)) {
      if (root.closest(FOOT)) continue;
      for (const el of root.querySelectorAll('a[href], button, [role="menuitem"], [role="tab"], [aria-haspopup], [aria-expanded]')) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (!shown(el) || isHome(el)) continue;
        const name = groupName(words(el, 40, true) || el.getAttribute("aria-label") || "");
        // A name of words: not the bag's "0", not an icon's nothing.
        if (!name || name.length > 30 || !/\p{L}/u.test(name)) continue;
        const opens =
          el.matches('button, [role="button"], [role="menuitem"], [role="tab"], [aria-haspopup], [aria-expanded], [aria-controls]') &&
          el.getAttribute("aria-haspopup") !== "dialog";
        if (opens) says.push({ el, name });
        else if (el.getBoundingClientRect().top < 250) plain.push({ el, name });
      }
    }
    return [...says.slice(0, 30), ...plain.slice(0, 12)];
  };
  const fire = (el, types) => {
    for (const type of types) {
      const init = { bubbles: !/enter|leave/.test(type), cancelable: true, composed: true, view: window, relatedTarget: document.body };
      el.dispatchEvent(/^pointer/.test(type) ? new PointerEvent(type, { ...init, pointerType: "mouse", isPrimary: true }) : new MouseEvent(type, init));
    }
  };
  /** A link that goes somewhere: never clicked, whatever role it claims (Burberry's tabs are `<a role="button">`). */
  const goes = (el) => {
    const a = el.closest("a[href]");
    const href = a ? (a.getAttribute("href") || "").trim() : "";
    return !!a && !!href && !href.startsWith("#") && !/^javascript:/i.test(href);
  };
  /** A control that opens a part of the menu on a click and goes nowhere: a button saying it is shut. */
  const clickOpens = (el) =>
    el.matches('button:not([type="submit"]), [role="button"], summary') &&
    el.getAttribute("aria-expanded") === "false" &&
    el.getAttribute("aria-haspopup") !== "dialog" &&
    !goes(el) &&
    !el.closest("form");
  /** While the menu is opened, no click takes the tab anywhere. */
  const stay = (event) => {
    const a = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (a && goes(a)) event.preventDefault();
  };

  const out = readNow();
  // `open: false` reads the page as it stands (the tests of the reading itself).
  if (options.open === false) return { ok: true, url: location.href, links: out };
  const known = new Set(out.map((l) => l.url));
  const bar = barItems();
  const until = Date.now() + 15_000;
  /** Links some item's opening put in the page but no item showed: kept as read. */
  const unshown = new Map();
  document.addEventListener("click", stay, true);
  for (const { el, name } of bar) {
    if (Date.now() > until || !el.isConnected) break;
    const settled = watch();
    fire(el, ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]);
    const clicked = clickOpens(el);
    if (clicked) el.click();
    if (!(await settled(250, 1_200))) {
      if (clicked && el.getAttribute("aria-expanded") === "true") el.click();
      fire(el, ["pointerout", "pointerleave", "mouseout", "mouseleave"]);
      continue;
    }
    for (const link of readNow(true)) {
      if (known.has(link.url)) continue;
      // In the page but not on screen: another item's panel, kept hidden.
      // That item shows it when its turn comes.
      if (!link.shown) {
        unshown.set(link.url, link);
        continue;
      }
      known.add(link.url);
      delete link.shown;
      // On screen once this item is open: the item's own, wherever the page
      // keeps it (Burberry moves the open panel out of its tab, into a box
      // of its own, where "Bags" heads Women's bags, not the Bags tab's).
      if (link.where !== "page" && !(link.trail[0] && link.trail[0].toLowerCase() === name.toLowerCase())) {
        link.trail = [name, ...link.trail].slice(0, MAX_DEPTH);
      }
      out.push(link);
    }
    if (clicked && el.getAttribute("aria-expanded") === "true") el.click();
    fire(el, ["pointerout", "pointerleave", "mouseout", "mouseleave"]);
    await sleep(50);
  }
  document.removeEventListener("click", stay, true);
  for (const [url, link] of unshown) {
    if (known.has(url)) continue;
    delete link.shown;
    out.push(link);
  }
  return { ok: true, url: location.href, links: out.slice(0, 5000) };
}

// ── Which links are categories ───────────────────────────────────────────────

/** Categories one run walks, at most. */
export const MAX_CATEGORIES = 1_500;

/**
 * Menu links a store needs before its menu is trusted on its own. Fewer, and
 * the links in the page itself are read too: a store whose menu is drawn only
 * when it is opened still shows its categories as tiles on the home page.
 */
const MIN_MENU = 3;

/**
 * Path segments that are never a category: the store's furniture rather than
 * its shelves. The server's `NON_PRODUCT_SEGMENTS` (extract.ts) and then some,
 * because here the question is whether a page lists pieces at all.
 */
const NOT_A_CATEGORY = new Set([
  "cart", "bag", "basket", "checkout", "login", "logout", "signin", "sign-in", "signout", "sign-out",
  "signup", "sign-up", "register", "registration", "account", "my-account", "myaccount", "profile",
  "auth", "wishlist", "favourites", "favorites", "saved", "help", "faq", "faqs", "support",
  "customer-service", "customer-care", "customerservice", "contact", "contact-us", "contacts",
  "about", "about-us", "our-story", "company", "careers", "career", "jobs", "press", "privacy",
  "privacy-policy", "terms", "terms-and-conditions", "terms-of-service", "terms-of-use", "legal",
  "imprint", "impressum", "cookie", "cookies", "cookie-policy", "returns", "return", "refund",
  "refunds", "shipping", "delivery", "payment", "payments", "size-guide", "sizing", "size-chart",
  "store-locator", "storelocator", "stores", "store-finder", "find-a-store", "gift-card",
  "gift-cards", "giftcard", "giftcards", "blog", "blogs", "news", "magazine", "editorial", "journal",
  "stories", "story", "search", "sitemap", "newsletter", "subscribe", "feedback", "reviews",
  "track-order", "order-tracking", "orders", "order-status", "sustainability", "investors",
  "investor-relations", "affiliates", "affiliate", "app", "apps", "download", "accessibility",
  "policies", "policy", "pages", "community", "events", "membership", "loyalty", "rewards",
]);

/** Query parameters that say who sent the visitor, never which page it is. */
const TRACKING =
  /^(?:utm_[a-z_]+|srsltid|gclid|gclsrc|gbraid|wbraid|dclid|fbclid|yclid|msclkid|ttclid|igshid|mc_cid|mc_eid|_ga|_gl|ref|ref_src|referrer|spm|scm|cmpid|icid|intcmp|cm_sp|cm_re)$/i;

/** Query parameters that switch the store to another country or language. */
const LOCALE_PARAM = /^(?:lang|language|locale|country|currency|region|hl|shipto|ship_to|site)$/i;

/** Query parameters that only sort or filter a category: the category is the address without them. */
const VIEW_PARAM =
  /^(?:sort|sortby|sort_by|order|orderby|order_by|dir|view|page|pg|p|limit|per_page|perpage|show|size|sizes|color|colour|colors|colours|price|min_price|max_price|instock|in_stock|available|filter(?:\..*|\[.*\])?|f)$/i;

/** A file that is not a page: `look-book.pdf`, `logo.png`, `feed.xml`. */
const NOT_A_PAGE = /\.(?!(?:html?|aspx?|php|jsp|cfm)$)[a-z0-9]{2,5}$/i;

/** A path segment naming a country or a language: `en`, `en-us`, `ua`, `en_GB`. */
const LOCALE = /^[a-z]{2}(?:[-_][a-z]{2,4})?$/i;

/**
 * The language part of an address: `/en-us`, `/ua/en`, or "".
 *
 * A store's menu, and its sitemaps more so, link the same catalogue in every
 * language it speaks. Walked as they come, the run would collect each piece
 * once per language. So the run keeps to the language of the page the admin
 * started on.
 */
export function localePrefix(pathname) {
  const out = [];
  // At most two: a country and a language (`/ua/en`), in either order.
  for (const s of String(pathname || "").split("/").filter(Boolean).slice(0, 2)) {
    if (!LOCALE.test(s)) break;
    out.push(s.toLowerCase());
  }
  return out.length ? `/${out.join("/")}` : "";
}

/** Is this address in the same language as the start page? */
export function sameLocale(url, prefix) {
  try {
    return localePrefix(new URL(url).pathname) === prefix;
  } catch {
    return false;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** An address without its query and fragment: how the planner names a page. */
export function pagePath(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "";
  }
}

/**
 * One link as a category address, or "" when it is not one.
 *
 * Tracking tags and sort or filter parameters are taken off, so "Jackets" and
 * "Jackets, newest first" are one category. A link that switches country or
 * language, leads to the cart, an account page, help, the blog, or a file, is
 * not a category at all.
 */
export function categoryAddress(href, startUrl) {
  let u;
  let start;
  try {
    start = new URL(startUrl);
    u = new URL(href, start);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  if (hostOf(u.href) !== hostOf(start.href)) return "";
  u.hash = "";

  const segs = u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
  if (!segs.length && !u.search) return ""; // the home page
  if (segs.some((s) => NOT_A_CATEGORY.has(s))) return "";
  if (segs.length && NOT_A_PAGE.test(segs[segs.length - 1])) return "";
  if (localePrefix(u.pathname) !== localePrefix(start.pathname)) return "";

  const kept = [];
  for (const [k, v] of u.searchParams) {
    if (LOCALE_PARAM.test(k)) return "";
    if (TRACKING.test(k) || VIEW_PARAM.test(k)) continue;
    kept.push([k, v]);
  }
  u.search = kept.length ? `?${new URLSearchParams(kept).toString()}` : "";
  if (!segs.length && !u.search) return "";
  return u.href;
}

/**
 * The categories worth walking, in the order the store's menu lists them.
 *
 * `links` is what `menuStep` read. The menu and the footer are the store's own
 * list of its shelves; the page itself is read too only when the menu offers
 * fewer than `MIN_MENU`. Each category once, by its address without a trailing
 * slash. The start page is not among them: the run walks it first anyway.
 */
export function categoryCandidates(links, startUrl, max = MAX_CATEGORIES) {
  const list = Array.isArray(links) ? links : [];
  const startKey = keyOf(categoryAddress(startUrl, startUrl) || startUrl.split("#")[0]);

  const pick = (pool) => {
    const out = [];
    const byKey = new Map([[startKey, null]]);
    // The menu's outermost folders: a link named like one is that tab's own page.
    const tabs = [...new Set(pool.map((l) => cleanTrail(l && l.trail)[0]).filter(Boolean))];
    for (const link of pool) {
      if (!link || typeof link.url !== "string") continue;
      const url = categoryAddress(link.url, startUrl);
      if (!url) continue;
      const key = keyOf(url);
      const trail = cleanTrail(link.trail);
      if (byKey.has(key)) {
        // The same link listed again in the same part of the page (Kith: once
        // in the header, alone, then in the drawer under "Mens"): it keeps its
        // place and takes the first groups it has. Not a different link to the
        // same page ("New coats" in Sale's panel, to Coats), not a copy in the
        // footer or a brand list, and never a tab's own page: "Children" stays
        // with the Children folder, wherever else the footer lists it.
        const seen = byKey.get(key);
        if (
          seen &&
          !seen.trail.length &&
          trail.length &&
          seen.where === (link.where || "page") &&
          sameName(seen.label, cleanLabel(link.label) || labelFromPath(url)) &&
          !tabs.some((t) => sameName(t, seen.label))
        ) {
          seen.trail = trail;
        }
        continue;
      }
      if (out.length >= max) continue;
      const category = { url, label: cleanLabel(link.label) || labelFromPath(url), where: link.where || "page", trail };
      byKey.set(key, category);
      out.push(category);
    }
    return out;
  };

  const menu = pick(list.filter((l) => l && (l.where === "menu" || l.where === "footer")));
  if (menu.length >= MIN_MENU) return menu;
  return pick(list);
}

function keyOf(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`.toLowerCase();
  } catch {
    return url;
  }
}

function cleanLabel(label) {
  return typeof label === "string" ? label.replace(/\s+/g, " ").trim().slice(0, 60) : "";
}

/** The groups `menuStep` read around a link, as names: at most five, none empty. */
function cleanTrail(trail) {
  return (Array.isArray(trail) ? trail : []).map(cleanLabel).filter(Boolean).slice(0, 5);
}

// ── The menu as a tree ───────────────────────────────────────────────────────
//
// The popup lists the categories as folders, the way the store's menu holds
// them: Men › Clothes › Coats. A folder is ticked or unticked as a whole, so
// "Children" goes with one tick, not forty.

/** A folder this big, all of one level, is split by the store's addresses. */
const SPLIT_AT = 12;
/** Folders made from addresses, at most this deep under where they start. */
const SPLIT_DEPTH = 2;

/** Names compared as a person compares them: case, accents of punctuation and spaces aside. */
function sameName(a, b) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return norm(a) === norm(b);
}

/**
 * A category's address as folders: the path after the language part, each
 * segment without the store's number on it (`bekleidung-20204` is
 * `bekleidung`), the last one apart.
 */
function pathParts(url) {
  try {
    const u = new URL(url);
    const prefix = localePrefix(u.pathname).split("/").filter(Boolean).length;
    const segs = u.pathname
      .split("/")
      .filter(Boolean)
      .slice(prefix)
      .map((s) => {
        let d = s;
        try {
          d = decodeURIComponent(s);
        } catch {
          /* a malformed escape stays as written */
        }
        return d.toLowerCase().replace(/\.[a-z]+$/, "").replace(/[-_]\d{3,}$/, "");
      });
    // A category named by its query (`/c/shoes?brand=nike`): the whole path is its folder.
    if (u.search) return { dirs: segs, last: u.search };
    return { dirs: segs.slice(0, -1), last: segs[segs.length - 1] || "" };
  } catch {
    return { dirs: [], last: "" };
  }
}

/** A name that says "everything here", which names no folder. */
const GENERIC =
  /^(?:(?:view|shop|see|show|explore|discover|browse)\s+(?:all|everything)\b.*|all|everything|entdecke alles|alles(?: ansehen| anzeigen)?|tout voir|voir tout|ver todo|vedi tutto|bekijk alles|zobacz wszystko|смотреть все|все|усі|переглянути все)$/i;

/** "mens-clothing" → "Mens clothing": a folder named from an address. */
function folderName(segment) {
  const t = String(segment || "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? (t[0].toUpperCase() + t.slice(1)).slice(0, 60) : "";
}

/**
 * Split one folder's categories by their addresses: About You keeps ninety
 * of them under one heading, "Shop by category", while its addresses say
 * `/c/frauen/bekleidung/…`, `/c/frauen/schuhe/…`. Returns the extra folder
 * names for each category, or null when the addresses do not split them.
 */
function splitByPath(items, depth) {
  if (depth >= SPLIT_DEPTH || items.length < 4) return null;
  // Small folders are left as the menu has them, unless two of their
  // categories go by one name (About You's "Highlights": "Neu" three times).
  const twins = items.some((c, i) => items.findIndex((d) => sameName(d.label, c.label)) !== i);
  if (items.length < SPLIT_AT && !twins) return null;
  const parts = items.map((c) => pathParts(c.url));
  // The folders they all share say nothing: `/c/frauen/…`.
  let common = parts[0].dirs.length;
  for (const p of parts) {
    let i = 0;
    while (i < common && i < p.dirs.length && p.dirs[i] === parts[0].dirs[i]) i++;
    common = i;
  }
  // A store's shorthand (`/c/`, `/l/`, `/s/`) names no folder.
  const keyOf = (p) => (p.dirs.length > common && /^(?=.*\p{L}).{3,}$/u.test(p.dirs[common]) ? p.dirs[common] : "");
  const sizes = new Map();
  for (const p of parts) {
    const k = keyOf(p);
    if (k) sizes.set(k, (sizes.get(k) || 0) + 1);
  }
  const kept = [...sizes].filter(([, n]) => n >= 2).map(([k]) => k);
  if (kept.length < 2) return null;
  const names = new Map();
  for (const k of kept) {
    // Named as the store names it, when the folder's own page is in the menu
    // and its name is its own: not "View all" or "Entdecke alles", and not a
    // name another of these categories also goes by.
    const own = items.find((c, i) => !keyOf(parts[i]) && parts[i].dirs.length === common && parts[i].last === k);
    const mine = own && !GENERIC.test(own.label) && !items.some((c) => c !== own && sameName(c.label, own.label));
    names.set(k, mine ? own.label : folderName(k));
  }
  // Two parts named alike would be one folder: they go by their addresses.
  for (const k of kept) {
    if (kept.some((o) => o !== k && sameName(names.get(o), names.get(k)))) names.set(k, folderName(k));
  }
  return parts.map((p) => {
    const k = keyOf(p);
    if (names.has(k)) return { name: names.get(k), key: k };
    // A folder's own page goes in with it.
    if (!k && p.dirs.length === common && names.has(p.last)) return { name: names.get(p.last), key: p.last, own: true };
    return null;
  });
}

/**
 * The categories with the folders each sits in, `group`, outermost first:
 * the groups `menuStep` read off the menu, tidied.
 *
 * - The footer's links are a folder of their own, "Footer".
 * - A category named like a folder beside it is that folder's own page and
 *   goes in it: the link "Men" in the folder "Men".
 * - A big folder whose categories' addresses fall into parts is split by them,
 *   and so are the categories no group was found for.
 * - A folder holding only one folder is one folder: "Black Friday › Open Black
 *   Friday" is "Black Friday". The whole menu in one folder is no folder.
 *
 * Order is the menu's. Nothing is dropped; a category without folders stands
 * at the top.
 */
export function menuGroups(categories) {
  const list = (Array.isArray(categories) ? categories : []).filter((c) => c && typeof c.url === "string");
  let groups = list.map((c) => {
    const trail = cleanTrail(c.trail);
    return c.where === "footer" && !sameName(trail[0], "Footer") ? ["Footer", ...trail] : trail;
  });
  const keyOf = (g) => g.map((n) => n.toLowerCase()).join("\u0000");

  // A folder's own page, named like it, goes in it. Folders by where they
  // hang, with their names as the menu spells them.
  const subfolders = new Map();
  for (const g of groups) {
    for (let i = 0; i < g.length; i++) {
      const at = keyOf(g.slice(0, i));
      if (!subfolders.has(at)) subfolders.set(at, []);
      if (!subfolders.get(at).some((n) => n.toLowerCase() === g[i].toLowerCase())) subfolders.get(at).push(g[i]);
    }
  }
  groups = groups.map((g, i) => {
    const own = (subfolders.get(keyOf(g)) || []).find((n) => sameName(n, list[i].label));
    return own ? [...g, own] : g;
  });

  // Big flat folders, split by the addresses.
  const split = (indexes, depth) => {
    const extra = splitByPath(
      indexes.map((i) => list[i]),
      depth,
    );
    if (!extra) return;
    const byKey = new Map();
    indexes.forEach((i, j) => {
      if (!extra[j]) return;
      groups[i] = [...groups[i], extra[j].name];
      // A folder's own page is in it, not one of its parts.
      if (extra[j].own) return;
      if (!byKey.has(extra[j].key)) byKey.set(extra[j].key, []);
      byKey.get(extra[j].key).push(i);
    });
    for (const sub of byKey.values()) split(sub, depth + 1);
  };
  const byGroup = new Map();
  groups.forEach((g, i) => {
    const k = keyOf(g);
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k).push(i);
  });
  for (const indexes of byGroup.values()) split(indexes, 0);

  // A folder holding only one folder and nothing else is one folder.
  let changed = true;
  while (changed) {
    changed = false;
    const leaves = new Map();
    const kids = new Map();
    for (const g of groups) {
      leaves.set(keyOf(g), (leaves.get(keyOf(g)) || 0) + 1);
      for (let i = 1; i <= g.length; i++) {
        const parent = keyOf(g.slice(0, i - 1));
        if (!kids.has(parent)) kids.set(parent, new Set());
        kids.get(parent).add(keyOf(g.slice(0, i)));
      }
    }
    for (const [parent, set] of kids) {
      // The footer is a folder of its own: the menu in one folder beside it is still no folder.
      const only = parent ? set : new Set([...set].filter((k) => k !== "footer"));
      if (only.size !== 1 || leaves.get(parent)) continue;
      if (!parent && only.size !== set.size && [...only][0] === "footer") continue;
      const depth = parent ? parent.split("\u0000").length : 0;
      // The menu as a whole in one folder: no folder. Else the outer name stays.
      const folder = [...only][0];
      groups = groups.map((g) =>
        g.length > depth && keyOf(g.slice(0, depth)) === parent && keyOf(g.slice(0, depth + 1)) === folder
          ? depth
            ? [...g.slice(0, depth), ...g.slice(depth + 1)]
            : g.slice(1)
          : g,
      );
      changed = true;
      break;
    }
  }

  return list.map((c, i) => ({ ...c, group: groups[i] }));
}

/**
 * A category as the menu places it: "Men › Clothes › View All". The folders
 * go first; a folder's own page ("Men" in the folder "Men") is said once.
 */
export function categoryName(category, max = 120) {
  const group = cleanTrail(category && category.group);
  const label = cleanLabel(category && category.label);
  const names = label && group.length && sameName(group[group.length - 1], label) ? group : [...group, label].filter(Boolean);
  // The site reads 120 characters of a name (`rule-choice.ts`): the middle
  // folders give way, never the outermost or the category itself.
  const long = () => names.join(" › ").length > max;
  while (long() && names.length > 2) {
    if (names[1] !== "…") names[1] = "…";
    else if (names.length > 3) names.splice(2, 1);
    else names.splice(1, 1);
  }
  // Still too long, two names: the outer one gives way, the category never.
  if (long() && names.length === 2) names[0] = `${names[0].slice(0, Math.max(1, max - names[1].length - 4))}…`;
  return names.join(" › ").slice(0, max);
}

/** "Men · Jackets" out of `/men/jackets`, for a link that says nothing itself. */
export function labelFromPath(url) {
  try {
    const segs = new URL(url).pathname.split("/").filter(Boolean);
    const prefix = localePrefix(new URL(url).pathname).split("/").filter(Boolean).length;
    const words = segs
      .slice(prefix)
      .map((s) => decodeURIComponent(s).replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ").trim())
      // `/c/…`, `/p/…`: a store's own shorthand, not a name.
      .filter((w) => w.length > 2);
    return words.slice(-2).join(" · ").slice(0, 60) || "/";
  } catch {
    return "";
  }
}

// ── What one plan call is handed ─────────────────────────────────────────────

/**
 * Links handed to the planner in one call. It answers with at most 2,000
 * products (`planCollection`'s cap), and products are a part of the links it
 * is sent, so a chunk this size can never lose one to the cap. A walk of a
 * category bigger than that is planned in several calls.
 */
export const PLAN_LINKS = 1_500;

/**
 * Addresses in one piece of a sitemap, in the sweep. The pieces of a run that
 * wants a few hundred pieces are cut by bytes alone (sitemap-pieces.js), up to
 * twenty thousand addresses a piece, of which the planner returns its 2,000.
 * The whole store needs every one, so the sweep cuts by count too.
 */
export const SWEEP_ENTRIES = 1_500;

// ── Sitemaps, all of them ────────────────────────────────────────────────────

/**
 * The child sitemaps of an index worth reading, products first.
 *
 * The planner reads ten children out of an index (`MAX_CHILDREN_PER_INDEX` in
 * plan-collection.ts): enough for a run that wants a few hundred pieces, not
 * for a store with sixty product sitemaps. So for the whole store the index
 * is read here, with the same ranking as `rankChild` in sitemap.ts (and
 * verification/test-site.js holds the two to the same answers): sitemaps
 * named after products first, never the blog's, pages', collections' or
 * marketing ones. Only the store's own host.
 */
export function sitemapChildren(xml, host) {
  const want = String(host || "").replace(/^www\./, "").toLowerCase();
  const out = [];
  const seen = new Set();
  for (const m of String(xml || "").matchAll(/<loc>\s*(?:<!\[CDATA\[\s*)?([^<\s\]]+)/gi)) {
    const url = m[1].replace(/&amp;/g, "&");
    if (seen.has(url) || hostOf(url) !== want) continue;
    seen.add(url);
    out.push({ url, rank: rankChild(url), at: out.length });
  }
  return out
    .filter((c) => c.rank < 2)
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map((c) => c.url);
}

/** `rankChild` in sitemap.ts, word for word. */
export function rankChild(url) {
  const u = String(url).toLowerCase();
  if (/product/.test(u)) return 0;
  if (/(?:blog|article|page|collection|marketing)/.test(u)) return 2;
  return 1;
}

export function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(String(xml || ""));
}

// ── What has been opened already ─────────────────────────────────────────────

const DB_NAME = "goo-collect";
const SEEN = "seen";

/**
 * Every piece a whole-store run has opened, so no piece is opened twice: not
 * in the next category that shows it, not in the sitemaps, not after Resume.
 *
 * Kept in IndexedDB, which a six-hundred-thousand-address list fits in and
 * `chrome.storage` does not. Where IndexedDB cannot be opened the list lives
 * in memory: the run still opens nothing twice, it only forgets on a restart.
 */
export class SeenStore {
  constructor() {
    this.db = null;
    this.memory = null;
  }

  async open() {
    if (this.db || this.memory) return;
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(SEEN)) req.result.createObjectStore(SEEN);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("blocked"));
      });
      this.db.onclose = () => {
        this.db = null;
      };
    } catch {
      this.db = null;
      this.memory = new Set();
    }
  }

  /**
   * One transaction: `work` queues its requests on the store and returns a
   * promise of what they come to, which is answered once the transaction
   * has completed, so a write is on disk before the run moves on.
   */
  tx(mode, work) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(SEEN, mode);
      const value = Promise.resolve(work(t.objectStore(SEEN)));
      t.oncomplete = () => value.then(resolve, reject);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("aborted"));
    });
  }

  async clear() {
    await this.open();
    if (this.memory) return this.memory.clear();
    await this.tx("readwrite", (store) => void store.clear());
  }

  async add(url) {
    await this.open();
    if (this.memory) return void this.memory.add(url);
    await this.tx("readwrite", (store) => void store.put(1, url));
  }

  /** Many at once, in one transaction: the pieces AI left out of a plan. */
  async addAll(urls) {
    await this.open();
    const list = (urls || []).filter((u) => typeof u === "string" && u);
    if (this.memory) return void list.forEach((u) => this.memory.add(u));
    if (!list.length) return;
    await this.tx("readwrite", (store) => void list.forEach((u) => store.put(1, u)));
  }

  /** The addresses not opened yet, each once, in the order given. */
  async fresh(urls) {
    await this.open();
    const list = [...new Set((urls || []).filter((u) => typeof u === "string" && u))];
    if (this.memory) return list.filter((u) => !this.memory.has(u));
    const asked = (store, u) =>
      new Promise((resolve) => {
        const req = store.count(u);
        req.onsuccess = () => resolve(req.result ? "" : u);
        req.onerror = () => resolve(u);
      });
    const out = await this.tx("readonly", (store) => Promise.all(list.map((u) => asked(store, u))));
    return out.filter(Boolean);
  }

  async count() {
    await this.open();
    if (this.memory) return this.memory.size;
    return this.tx(
      "readonly",
      (store) =>
        new Promise((resolve) => {
          const req = store.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        }),
    );
  }
}
