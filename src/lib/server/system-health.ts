import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { isMonobankConfigured, pingMonobank } from "@/lib/server/monobank";
import { getLastEventAt } from "@/lib/server/subscriptions";

/*
 * The dashboard's service row (GS1-1): whether each service works, asked of the
 * service itself. Green used to mean "a key is set" — a revoked monobank token
 * or a dead OpenAI key read as healthy.
 *
 * - OpenAI, Replicate, Resend and monobank get one cheap authenticated request
 *   each; the answer and its time are the state.
 * - The renewal cron is judged by its heartbeat in billing_events: older than
 *   36 hours, or none at all, is red — the same rule as on Subscriptions.
 * - Payments are switched off on purpose while MONOBANK_TOKEN is unset (CEO,
 *   2026-10-05): monobank and the cron then read "off", grey, not broken.
 *
 * Every probe gives up after PROBE_TIMEOUT_MS, so a service that hangs costs
 * the dashboard four seconds at most, and the answers are kept for a minute so
 * opening the dashboard does not ping five services every time. Refresh asks
 * again.
 *
 * States and codes, not sentences: the page words them in the admin's language.
 */

export type ServiceKey = "supabase" | "clerk" | "openai" | "replicate" | "resend" | "monobank" | "cron";
export type ServiceState = "ok" | "err" | "off";

export type ServiceCheck = {
  key: ServiceKey;
  state: ServiceState;
  /**
   * What the state rests on:
   * connected · answered (with `ms`) · send_only · key_set · no_key · rejected
   * · timeout · error (with `message`) · ran / stale (with `at`) · never_ran
   * · no_secret (CRON_SECRET unset: the task can only get 401) · off
   */
  code: string;
  ms?: number;
  at?: string;
  message?: string;
};

export const PROBE_TIMEOUT_MS = 4_000;
/** The renewal cron runs daily; a heartbeat older than this means it stopped. */
export const CRON_STALE_HOURS = 36;
const CACHE_MS = 60_000;

/** Payments are off by decision while there is no monobank token to take them with. */
export const paymentsOff = !isMonobankConfigured;

function failed(key: ServiceKey, e: unknown): ServiceCheck {
  const message = e instanceof Error ? e.message : String(e);
  const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
  return timeout ? { key, state: "err", code: "timeout" } : { key, state: "err", code: "error", message };
}

/** A GET with a bearer token: answered, rejected, or failed. */
async function bearerProbe(key: ServiceKey, url: string, token: string): Promise<ServiceCheck> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (res.ok) return { key, state: "ok", code: "answered", ms: Date.now() - started };
    const body = (await res.json().catch(() => null)) as { name?: string; message?: string } | null;
    // A Resend key limited to sending cannot list domains, and that is how
    // most are issued: it is set and it works for what the app does with it.
    if (key === "resend" && body?.name === "restricted_api_key") return { key, state: "ok", code: "send_only" };
    // 401/403, or Resend's 400 "API key is invalid" for a key of the wrong shape.
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(body?.message ?? ""))) {
      return { key, state: "err", code: "rejected" };
    }
    return { key, state: "err", code: "error", message: body?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return failed(key, e);
  }
}

async function openaiCheck(): Promise<ServiceCheck> {
  try {
    const key = await getOpenAIKey();
    if (!key) return { key: "openai", state: "err", code: "no_key" };
    return bearerProbe("openai", "https://api.openai.com/v1/models", key);
  } catch (e) {
    return failed("openai", e);
  }
}

function replicateCheck(): Promise<ServiceCheck> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) return Promise.resolve({ key: "replicate", state: "err", code: "no_key" });
  return bearerProbe("replicate", "https://api.replicate.com/v1/account", token);
}

function resendCheck(): Promise<ServiceCheck> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return Promise.resolve({ key: "resend", state: "err", code: "no_key" });
  return bearerProbe("resend", "https://api.resend.com/domains", key);
}

async function monobankCheck(): Promise<ServiceCheck> {
  if (paymentsOff) return { key: "monobank", state: "off", code: "off" };
  const res = await pingMonobank(PROBE_TIMEOUT_MS);
  if (res.ok) return { key: "monobank", state: "ok", code: "answered", ms: res.ms };
  if (res.status === 401 || res.status === 403) return { key: "monobank", state: "err", code: "rejected" };
  return /timeout|abort/i.test(res.message)
    ? { key: "monobank", state: "err", code: "timeout" }
    : { key: "monobank", state: "err", code: "error", message: res.message };
}

async function cronCheck(): Promise<ServiceCheck> {
  if (paymentsOff) return { key: "cron", state: "off", code: "off" };
  if (!process.env.CRON_SECRET?.trim()) return { key: "cron", state: "err", code: "no_secret" };
  try {
    const last = await getLastEventAt("cron_run");
    if (!last) return { key: "cron", state: "err", code: "never_ran" };
    const hours = (Date.now() - last.getTime()) / 3_600_000;
    return { key: "cron", state: hours > CRON_STALE_HOURS ? "err" : "ok", code: hours > CRON_STALE_HOURS ? "stale" : "ran", at: last.toISOString() };
  } catch (e) {
    return failed("cron", e);
  }
}

let cache: { at: number; checks: ServiceCheck[] } | null = null;

/**
 * The external services, probed in parallel (Supabase and Clerk are judged by
 * the dashboard's own queries). `fresh` skips the minute-long cache.
 */
export async function probeServices(fresh = false): Promise<ServiceCheck[]> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.checks;
  const checks = await Promise.all([openaiCheck(), replicateCheck(), resendCheck(), monobankCheck(), cronCheck()]);
  cache = { at: Date.now(), checks };
  return checks;
}
