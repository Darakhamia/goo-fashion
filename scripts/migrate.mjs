#!/usr/bin/env node
/**
 * Applies the database migrations the live database has not run yet.
 *
 * Runs on every deploy, before the site starts (`npm run start`). Reads the
 * numbered files in supabase/migrations, asks the database which of them it has
 * recorded in `schema_migrations`, and sends each missing one — in file order —
 * to the `goo_apply_migration` function created by migration 026. Each file runs
 * in its own transaction: one that fails leaves nothing half-applied, is not
 * recorded, and stops the run there, because a later file may depend on it.
 *
 * It talks to the database the way the site does — HTTPS to PostgREST with the
 * service-role key — so it works with the site and Supabase on different
 * servers, and needs no database port and no extra credentials.
 *
 * A failure never stops the site from starting: a deploy that crashes on boot is
 * an outage, while the site is written to tolerate a column that is not there
 * yet. The outcome is printed to the deploy log and stored in `settings` under
 * `migrations_last_run`, which Settings → Database schema shows.
 *
 *   node scripts/migrate.mjs            # on deploy: report problems, exit 0
 *   node scripts/migrate.mjs --strict   # CI or by hand: exit 1 on any problem
 *
 * Environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, as for the site.
 * SUPABASE_REST_URL overrides the PostgREST address (CI talks to it directly).
 *
 * No dependencies: it runs before anything else and must not need a build.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const STRICT = process.argv.includes("--strict");
const DIR = path.join(process.cwd(), "supabase", "migrations");
const FILE_NAME = /^[0-9]{3}_[a-z0-9_]+\.sql$/;
/** Asking what is applied should be quick; a migration may take longer. */
const LIST_TIMEOUT_MS = 15_000;
const APPLY_TIMEOUT_MS = 120_000;

const log = (msg) => console.log(`[migrate] ${msg}`);
const warn = (msg) => console.warn(`[migrate] ${msg}`);

function restBase() {
  const explicit = process.env.SUPABASE_REST_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const url = process.env.SUPABASE_URL?.trim();
  return url ? `${url.replace(/\/+$/, "")}/rest/v1` : "";
}

const BASE = restBase();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

async function rest(pathname, { method = "GET", body, headers = {}, timeoutMs = LIST_TIMEOUT_MS } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON — kept as text below */
  }
  return { ok: res.ok, status: res.status, json, text };
}

/** PostgREST's words for a failed request, short enough for one log line. */
function reason(res) {
  const j = res.json;
  const msg = j && typeof j === "object" ? [j.message, j.details, j.hint].filter(Boolean).join(" — ") : res.text;
  return `${res.status} ${String(msg || "").slice(0, 600)}`.trim();
}

/**
 * A file's own BEGIN / COMMIT lines, taken out.
 *
 * Each file already runs in one transaction (the function call), and Postgres
 * refuses transaction commands inside it — a file written for the SQL editor,
 * like 016, would fail on its first line. Only whole lines are removed, and
 * only outside dollar-quoted bodies: a function's `begin` and `end;` stay.
 */
const TRANSACTION_LINE =
  /^\s*(?:begin(?:\s+(?:transaction|work))?|start\s+transaction|commit(?:\s+(?:transaction|work))?|end\s+(?:transaction|work))\s*;\s*(?:--.*)?$/i;

export function withoutTransactionCommands(sql) {
  let open = null; // the dollar-quote tag we are inside, if any
  let removed = 0;
  const kept = [];
  for (const line of sql.split("\n")) {
    if (open === null && TRANSACTION_LINE.test(line)) {
      removed++;
      continue;
    }
    kept.push(line);
    const code = open === null ? line.replace(/--.*$/, "") : line;
    for (const [tag] of code.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g)) {
      if (open === null) open = tag;
      else if (tag === open) open = null;
    }
  }
  return { sql: kept.join("\n"), removed };
}

/** Remember how the run went, for Settings → Database schema. Best effort. */
async function recordRun(outcome) {
  try {
    await rest("/settings?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { key: "migrations_last_run", value: JSON.stringify(outcome), updated_at: outcome.at },
    });
  } catch {
    /* the settings table is optional here; the deploy log has it all */
  }
}

function finish(code) {
  process.exit(STRICT ? code : 0);
}

async function main() {
  const at = new Date().toISOString();

  if (!BASE || !KEY) {
    log("skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
    return finish(1);
  }

  let files;
  try {
    files = readdirSync(DIR).filter((f) => FILE_NAME.test(f)).sort();
  } catch (err) {
    warn(`cannot read ${DIR}: ${err.message}`);
    return finish(1);
  }

  let listed;
  try {
    listed = await rest("/schema_migrations?select=name,checksum&limit=10000");
  } catch (err) {
    warn(`database not reachable at ${BASE}: ${err.message}. Nothing applied.`);
    return finish(1);
  }
  if (!listed.ok) {
    const missing = listed.status === 404 || /schema_migrations/.test(listed.text);
    warn(
      missing
        ? "the database has no schema_migrations table yet — run supabase/migrations/026_migration_runner.sql once in the Supabase SQL editor. Nothing applied."
        : `could not read schema_migrations: ${reason(listed)}. Nothing applied.`,
    );
    await recordRun({ at, applied: [], failed: null, error: missing ? "026 not run" : reason(listed), pending: files });
    return finish(1);
  }

  const applied = new Map((listed.json ?? []).map((r) => [r.name, r.checksum ?? ""]));
  const pending = files.filter((f) => !applied.has(f));

  // A file edited after it ran is not run again — say so, so the edit goes into a new file.
  for (const f of files) {
    const stored = applied.get(f);
    if (!stored) continue;
    const now = createHash("sha256").update(readFileSync(path.join(DIR, f))).digest("hex");
    if (stored !== now) warn(`${f} changed after it was applied; it is not run again. Put further changes in a new file.`);
  }

  if (!pending.length) {
    log(`up to date (${applied.size} applied).`);
    await recordRun({ at, applied: [], failed: null, error: null, pending: [] });
    return finish(0);
  }

  log(`${pending.length} to apply: ${pending.join(", ")}`);
  const done = [];
  for (const name of pending) {
    const file = readFileSync(path.join(DIR, name), "utf8");
    const checksum = createHash("sha256").update(file).digest("hex");
    const { sql, removed } = withoutTransactionCommands(file);
    if (removed) log(`${name}: left out ${removed} BEGIN/COMMIT line(s) — the file runs in one transaction anyway.`);
    let res;
    try {
      res = await rest("/rpc/goo_apply_migration", {
        method: "POST",
        body: { p_name: name, p_sql: sql, p_checksum: checksum },
        timeoutMs: APPLY_TIMEOUT_MS,
      });
    } catch (err) {
      res = { ok: false, status: 0, json: null, text: err.message };
    }
    if (!res.ok) {
      const error = reason(res);
      warn(`${name} FAILED and was rolled back: ${error}`);
      const left = pending.slice(pending.indexOf(name));
      warn(`not applied: ${left.join(", ")}. The site starts anyway; fix the file and deploy again.`);
      await recordRun({ at, applied: done, failed: name, error, pending: left });
      return finish(1);
    }
    log(`${name}: ${res.json ?? "applied"}`);
    done.push(name);
  }

  log(`done — applied ${done.length}.`);
  await recordRun({ at, applied: done, failed: null, error: null, pending: [] });
  return finish(0);
}

// Run when executed, not when imported (the CI check imports the helpers).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    warn(`unexpected error: ${err?.stack || err}`);
    finish(1);
  });
}
