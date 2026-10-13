// A stand-in for GOO's Supabase, so the real app can run locally on fixtures.
//
//   node capture/mock-supabase.mjs            (port 54321)
//
// The app talks to Supabase only through supabase-js from the server, which is
// PostgREST over HTTP (src/lib/supabase.ts). This answers the reads the public
// pages make from the JSON tables in fixtures/db/, with enough of PostgREST's
// query language for them: select lists, eq/neq/gt/gte/lt/lte/like/ilike/in/is,
// not., cs/ov on arrays, or=(), order, limit/offset, Range, count=exact and
// single-object responses. Tables it has no file for are empty. Writes are
// accepted and dropped. RPCs answer an empty list.
//
// /storage/v1/object/public/<bucket>/<path> serves the photo copies in
// fixtures/storage/. With COPY_MISSING=1 a photo that is not there yet is copied
// once from supabase.goo-fashion.com and kept; without it a missing photo is a
// 404, so a capture run is fully offline once the copies exist.
//
// Every request is logged to stdout, so a page that reads something this
// doesn't serve shows up in the log rather than as a quietly different page.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DB = join(here, "fixtures/db");
const STORAGE = join(here, "fixtures/storage");
const PORT = Number(process.env.PORT ?? 54321);
const COPY_MISSING = process.env.COPY_MISSING === "1";
const LIVE_STORAGE = "https://supabase.goo-fashion.com/storage/v1/object/public/";

const tables = {};
for (const f of readdirSync(DB)) {
  if (f.endsWith(".json")) tables[f.slice(0, -5)] = JSON.parse(readFileSync(join(DB, f), "utf8"));
}

// ── PostgREST query language (the subset the app uses) ──────────────────────

/** Split on commas that are not inside (), {}, [] or quotes. */
function splitTop(s) {
  const parts = [];
  let depth = 0, quote = false, cur = "";
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    if (!quote && "({[".includes(ch)) depth++;
    if (!quote && ")}]".includes(ch)) depth--;
    if (ch === "," && depth === 0 && !quote) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);
const listOf = (v) => splitTop(v.replace(/^[({[]|[)}\]]$/g, "")).map((x) => unquote(x.trim()));

function coerce(cell, v) {
  if (typeof cell === "number") return Number(v);
  if (typeof cell === "boolean") return v === "true";
  return v;
}

function likeToRegex(pattern, flags) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*");
  return new RegExp(`^${esc}$`, flags);
}

/** One `op.value` test against a cell. */
function test(cell, opval) {
  let negate = false;
  if (opval.startsWith("not.")) { negate = true; opval = opval.slice(4); }
  const dot = opval.indexOf(".");
  const op = opval.slice(0, dot);
  const v = opval.slice(dot + 1);
  let r;
  switch (op) {
    case "eq": r = cell != null && String(cell) === unquote(v); break;
    case "neq": r = cell == null || String(cell) !== unquote(v); break;
    case "gt": r = cell != null && cell > coerce(cell, v); break;
    case "gte": r = cell != null && cell >= coerce(cell, v); break;
    case "lt": r = cell != null && cell < coerce(cell, v); break;
    case "lte": r = cell != null && cell <= coerce(cell, v); break;
    case "like": r = cell != null && likeToRegex(v, "").test(String(cell)); break;
    case "ilike": r = cell != null && likeToRegex(v, "i").test(String(cell)); break;
    case "in": r = cell != null && listOf(v).includes(String(cell)); break;
    case "is":
      r = v === "null" ? cell == null : v === "true" ? cell === true : v === "false" ? cell === false : false;
      break;
    case "cs": { const want = v.startsWith("[") ? JSON.parse(v) : listOf(v); r = Array.isArray(cell) && want.every((w) => cell.map(String).includes(String(w))); break; }
    case "cd": { const want = v.startsWith("[") ? JSON.parse(v) : listOf(v); r = Array.isArray(cell) && cell.every((c) => want.map(String).includes(String(c))); break; }
    case "ov": { const want = v.startsWith("[") ? JSON.parse(v) : listOf(v); r = Array.isArray(cell) && cell.some((c) => want.map(String).includes(String(c))); break; }
    default:
      console.warn(`  ! unsupported operator ${op}`);
      r = true;
  }
  return negate ? !r : r;
}

/** `or=(a.eq.1,b.ilike.*x*)` / `and=(...)`, nested. */
function logical(row, kind, body) {
  const terms = splitTop(body.replace(/^\(|\)$/g, "")).map((t) => t.trim());
  const results = terms.map((t) => {
    const m = t.match(/^(not\.)?(or|and)(\(.*\))$/);
    if (m) { const r = logical(row, m[2], m[3]); return m[1] ? !r : r; }
    const dot = t.indexOf(".");
    return test(row[t.slice(0, dot)], t.slice(dot + 1));
  });
  return kind === "or" ? results.some(Boolean) : results.every(Boolean);
}

function project(row, select) {
  if (!select || select.trim() === "*") return row;
  const out = {};
  for (let item of splitTop(select)) {
    item = item.trim();
    if (item === "*") { Object.assign(out, row); continue; }
    if (item.includes("(")) { console.warn(`  ! embedded select not served: ${item}`); continue; }
    const [alias, col] = item.includes(":") ? item.split(":") : [item, item];
    const name = col.split("::")[0];
    out[alias] = row[name] ?? null;
  }
  return out;
}

function query(table, params) {
  let rows = [...(tables[table] ?? [])];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(k)) continue;
    if (k === "or" || k === "and") { rows = rows.filter((r) => logical(r, k, v)); continue; }
    if (k === "not.or" || k === "not.and") { rows = rows.filter((r) => !logical(r, k.slice(4), v)); continue; }
    rows = rows.filter((r) => test(r[k], v));
  }
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((o) => {
      const [col, ...mods] = o.split(".");
      return { col, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") };
    });
    rows.sort((a, b) => {
      for (const { col, desc, nullsFirst } of keys) {
        const x = a[col], y = b[col];
        if (x == null && y == null) continue;
        // PostgreSQL: nulls sort last ascending, first descending, unless told.
        if (x == null) return nullsFirst || desc ? -1 : 1;
        if (y == null) return nullsFirst || desc ? 1 : -1;
        if (x < y) return desc ? 1 : -1;
        if (x > y) return desc ? -1 : 1;
      }
      return 0;
    });
  }
  return rows;
}

// ── HTTP ────────────────────────────────────────────────────────────────────

const TYPES = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml" };

async function serveStorage(path, res) {
  const rel = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, "");
  const file = join(STORAGE, rel);
  if (!existsSync(file)) {
    if (!COPY_MISSING) { res.writeHead(404).end(); console.log(`  storage MISS ${rel}`); return; }
    const r = await fetch(LIVE_STORAGE + rel);
    if (!r.ok) { res.writeHead(r.status).end(); console.log(`  storage ${r.status} ${rel}`); return; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    console.log(`  storage copied ${rel}`);
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000",
    "access-control-allow-origin": "*",
  });
  res.end(readFileSync(file));
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  try {
    if (path.startsWith("/storage/v1/object/public/")) {
      return await serveStorage(path.slice("/storage/v1/object/public/".length), res);
    }
    if (!path.startsWith("/rest/v1/")) { res.writeHead(404).end(); return; }

    const table = path.slice("/rest/v1/".length);
    if (table.startsWith("rpc/")) {
      await readBody(req);
      console.log(`${req.method} ${table} → []`);
      res.writeHead(200, { "content-type": "application/json" }).end("[]");
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      const body = await readBody(req);
      console.log(`${req.method} ${table}${url.search} (write dropped)`);
      const wantsRows = (req.headers.prefer ?? "").includes("return=representation");
      let rows = [];
      try { const parsed = JSON.parse(body || "[]"); rows = Array.isArray(parsed) ? parsed : [parsed]; } catch {}
      res.writeHead(wantsRows ? 201 : 204, { "content-type": "application/json" });
      res.end(wantsRows ? JSON.stringify(rows) : undefined);
      return;
    }

    if (!(table in tables)) console.log(`  (no fixture table "${table}", answering empty)`);
    const params = url.searchParams;
    let rows = query(table, params);
    const total = rows.length;

    let from = Number(params.get("offset") ?? 0);
    let to = params.has("limit") ? from + Number(params.get("limit")) - 1 : rows.length - 1;
    const range = req.headers.range?.match(/(\d+)-(\d+)?/);
    if (range) { from = Number(range[1]); if (range[2]) to = Math.min(to, Number(range[2])); }
    rows = rows.slice(from, to + 1).map((r) => project(r, params.get("select")));

    const headers = { "content-type": "application/json; charset=utf-8" };
    const counted = (req.headers.prefer ?? "").includes("count=");
    headers["content-range"] = `${rows.length ? `${from}-${from + rows.length - 1}` : "*"}/${counted ? total : "*"}`;

    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    console.log(`${req.method} ${table}${decodeURIComponent(url.search).slice(0, 160)} → ${rows.length}${single ? " (single)" : ""}`);
    if (single) {
      if (rows.length !== 1) {
        res.writeHead(406, headers).end(JSON.stringify({
          code: "PGRST116",
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        }));
        return;
      }
      res.writeHead(200, headers).end(req.method === "HEAD" ? undefined : JSON.stringify(rows[0]));
      return;
    }
    res.writeHead(200, headers).end(req.method === "HEAD" ? undefined : JSON.stringify(rows));
  } catch (e) {
    console.error(`ERROR ${req.method} ${req.url}`, e);
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ message: String(e) }));
  }
}).listen(PORT, "127.0.0.1", () => {
  const counts = Object.entries(tables).map(([k, v]) => `${k} ${v.length}`).join(", ");
  console.log(`mock supabase on http://127.0.0.1:${PORT} — ${counts}${COPY_MISSING ? " — copying missing photos" : ""}`);
});
