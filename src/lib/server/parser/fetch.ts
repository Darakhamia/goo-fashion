/**
 * Pluggable HTML fetcher for the universal parser.
 *
 * `direct` mode hits the target with realistic browser headers — enough for
 * soft targets. The provider modes (ScrapingBee / ScraperAPI / ZenRows /
 * custom) route the request through a scraping service that handles TLS/JA3
 * impersonation and headless rendering — the practical equivalent of running
 * curl_cffi / playwright server-side, which we can't do inside a Vercel
 * function. `custom` points at the admin's own endpoint template.
 */
import type { ParserFetchSettings, FetchProvider } from "./types";

// Realistic, current desktop User-Agent strings per impersonation profile.
const IMPERSONATE_UA: Record<string, string> = {
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  safari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  edge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
};

export function userAgentFor(impersonate: string): string {
  return IMPERSONATE_UA[impersonate] ?? IMPERSONATE_UA.chrome;
}

/** Browser-like request headers for `direct` mode. */
function browserHeaders(impersonate: string): Record<string, string> {
  const ua = userAgentFor(impersonate);
  const isChrome = impersonate === "chrome" || impersonate === "edge";
  return {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...(isChrome
      ? {
          "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
        }
      : {}),
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
}

// ── Cookies ──────────────────────────────────────────────────────────────────
// A soft wall is a shop that answers a first, cookie-less request with a
// refusal and a `Set-Cookie`, and the same request carrying that cookie with
// the page — the cheapest bot check there is, and the one a server request can
// actually pass. Node's fetch keeps no cookies of its own, so every request we
// made was the refused first one, over and over.
//
// The jar is per-host and per-process: a crawl walking twenty pages of one
// store now looks like one visitor rather than twenty strangers, which is also
// what a rate limiter is reading. It is not a session store — nothing is
// persisted, and a cold function starts empty.

const COOKIE_TTL_MS = 10 * 60_000;
/** Hosts kept at once. A crawl touches one store; this is only a leak guard. */
const MAX_COOKIE_HOSTS = 100;

const cookieJar = new Map<string, { cookies: Map<string, string>; at: number }>();

function jarKey(target: string): string | null {
  try {
    return new URL(target).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Store the cookies a direct response set, dropping the ones it just cleared. */
function rememberCookies(target: string, res: Response): void {
  const key = jarKey(target);
  if (!key) return;
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  if (!raw.length) return;

  const entry = cookieJar.get(key) ?? { cookies: new Map<string, string>(), at: Date.now() };
  for (const line of raw) {
    const pair = line.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    // An expiry in the past is the server deleting a cookie, not setting one.
    if (/;\s*max-age\s*=\s*0\b/i.test(line) || value === "" || value === "deleted") {
      entry.cookies.delete(name);
      continue;
    }
    entry.cookies.set(name, value);
  }
  entry.at = Date.now();
  if (entry.cookies.size) {
    cookieJar.set(key, entry);
    if (cookieJar.size > MAX_COOKIE_HOSTS) {
      const oldest = [...cookieJar.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cookieJar.delete(oldest[0]);
    }
  } else {
    cookieJar.delete(key);
  }
}

/** The `Cookie` header for a host, or "" when the jar has nothing fresh. */
function cookieHeaderFor(target: string): string {
  const key = jarKey(target);
  if (!key) return "";
  const entry = cookieJar.get(key);
  if (!entry) return "";
  if (Date.now() - entry.at > COOKIE_TTL_MS) {
    cookieJar.delete(key);
    return "";
  }
  return [...entry.cookies].map(([n, v]) => `${n}=${v}`).join("; ");
}

/** Tests only: a jar that outlives one store would make the next test a liar. */
export function resetCookieJar(): void {
  cookieJar.clear();
  warmedHosts.clear();
}

/** Hosts whose front door we already knocked on, so we do it once per run. */
const warmedHosts = new Map<string, number>();

/**
 * Ask for the store's front page so the wall can hand us its cookie, then let
 * the caller retry the page that was refused.
 *
 * Only on a 403, only once per host, and the answer is thrown away — the point
 * is the `Set-Cookie` that comes with it. A shop that refuses its own homepage
 * too costs one request and tells us the wall is not the soft kind.
 */
async function warmUpOrigin(target: string, settings: ParserFetchSettings): Promise<void> {
  const key = jarKey(target);
  if (!key) return;
  const at = warmedHosts.get(key);
  if (at !== undefined && Date.now() - at < COOKIE_TTL_MS) return;
  warmedHosts.set(key, Date.now());

  let origin: string;
  try {
    origin = new URL(target).origin + "/";
  } catch {
    return;
  }
  if (origin === target) return; // The front page IS what was refused.
  await requestOnce(origin, browserHeaders(settings.impersonate), settings, origin).catch(() => undefined);
}

/**
 * An IPv4 address as a 32-bit number, in any spelling `inet_aton` accepts:
 * dotted, or one to three parts with the last one filling the remaining bytes
 * ("127.1", "2130706433"), each part decimal, octal ("0177") or hex ("0x7f").
 * Null when the name is not all numbers; NaN when it is, but no address.
 */
function ipv4Value(h: string): number | null {
  const parts = h.split(".");
  if (parts.length > 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (/^0x[0-9a-f]*$/.test(part)) nums.push(part.length > 2 ? parseInt(part.slice(2), 16) : 0);
    else if (/^0[0-7]+$/.test(part)) nums.push(parseInt(part, 8));
    else if (/^(0|[1-9]\d*)$/.test(part)) nums.push(Number(part));
    else return null;
  }
  const last = nums.pop()!;
  if (nums.some((n) => n > 255) || last >= 256 ** (4 - nums.length)) return NaN;
  return nums.reduce((v, n, i) => v + n * 256 ** (3 - i), 0) + last;
}

function isBlockedIPv4(v: number): boolean {
  const a = Math.floor(v / 2 ** 24);
  const b = Math.floor(v / 2 ** 16) % 256;
  return (
    a === 0 || // "this network", 0.0.0.0
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** The eight 16-bit groups of an IPv6 literal (brackets already off), or null. */
function ipv6Groups(h: string): number[] | null {
  let s = h.split("%")[0]; // zone id: "fe80::1%eth0"
  // A trailing dotted quad ("::ffff:10.0.0.1") is the last two groups.
  const quad = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (quad) {
    const v = ipv4Value(quad[2]);
    if (v === null || Number.isNaN(v)) return null;
    s = `${quad[1]}${Math.floor(v / 65536).toString(16)}:${(v % 65536).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const gap = 8 - head.length - tail.length;
  if (halves.length === 2 ? gap < 1 : gap !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? gap : 0).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function isBlockedIPv6(h: string): boolean {
  const g = ipv6Groups(h);
  // A colon rules out a name, and this is no address either: nothing to dial.
  if (!g) return true;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  const embedded = g[6] * 65536 + g[7];
  if (zeros(6)) return true; // ::, ::1 and the deprecated IPv4-compatible ::a.b.c.d
  // IPv4-mapped (::ffff:a.b.c.d) and -translated (::ffff:0:a.b.c.d): the IPv4
  // address inside is what gets dialled.
  if (zeros(4) && ((g[4] === 0 && g[5] === 0xffff) || (g[4] === 0xffff && g[5] === 0))) {
    return isBlockedIPv4(embedded);
  }
  // NAT64 (64:ff9b::a.b.c.d) and 6to4 (2002:AABB:CCDD::) reach an IPv4 address too.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(embedded);
  }
  if (g[0] === 0x2002) return isBlockedIPv4(g[1] * 65536 + g[2]);
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/**
 * Block direct fetches to internal / loopback / link-local addresses (SSRF
 * defence). Only applied in `direct` mode — provider modes fetch from their own
 * infrastructure, not ours.
 *
 * The name is normalised first, since one internal address has many
 * spellings: `new URL()` keeps an IPv6 literal in brackets ("[::1]") and a
 * trailing dot ("localhost."), and a raw hostname can still carry the numeric
 * IPv4 forms a URL parser would have folded ("2130706433", "0x7f.1"). DNS is
 * not resolved here: a public name that points at a private address passes.
 */
export function isBlockedDirectHost(hostname: string): boolean {
  let h = hostname.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  h = h.replace(/\.+$/, "");
  if (!h) return true;

  if (h.includes(":")) return isBlockedIPv6(h);

  const v4 = ipv4Value(h);
  if (v4 !== null) return Number.isNaN(v4) || isBlockedIPv4(v4);

  if (
    h === "localhost" || h.endsWith(".localhost") ||
    h === "ip6-localhost" || h === "ip6-loopback" || h.endsWith(".localdomain") ||
    h.endsWith(".internal") || h.endsWith(".local") || h.endsWith(".home.arpa")
  ) {
    return true;
  }
  // A name with no dot is never a store: it is a container or a machine on our
  // own network ("kong", "supabase-db"), reached through the resolver's search
  // list.
  return !h.includes(".");
}

/** Validate a target URL is a fetchable public http(s) resource. */
export function validateTargetUrl(raw: string, provider: FetchProvider): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Only http(s) URLs are supported" };
  }
  if (provider === "direct" && isBlockedDirectHost(url.hostname)) {
    return { error: "Refusing to fetch a private/internal host directly" };
  }
  return { url };
}

/** Build the upstream URL for a scraping provider. */
function buildProviderUrl(
  provider: FetchProvider,
  settings: ParserFetchSettings,
  target: string,
  apiKey: string,
): string {
  const enc = encodeURIComponent(target);
  switch (provider) {
    case "scrapingbee":
      return `https://app.scrapingbee.com/api/v1/?api_key=${encodeURIComponent(apiKey)}&url=${enc}&render_js=${settings.renderJs ? "true" : "false"}`;
    case "scraperapi":
      return `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&url=${enc}&render=${settings.renderJs ? "true" : "false"}`;
    case "zenrows":
      return `https://api.zenrows.com/v1/?apikey=${encodeURIComponent(apiKey)}&url=${enc}&js_render=${settings.renderJs ? "true" : "false"}`;
    case "custom":
      // `{impersonate}` and `{timeout}` exist because the admin screen offers
      // both settings and they used to stop at our own door: in `direct` mode
      // the profile picks a User-Agent, and in every provider mode it did
      // nothing at all. A self-hosted curl_cffi service wants exactly this
      // value — it is the argument its `impersonate=` takes.
      return settings.endpoint
        .replace(/\{url\}/g, enc)
        .replace(/\{key\}/g, encodeURIComponent(apiKey))
        .replace(/\{render\}/g, settings.renderJs ? "true" : "false")
        .replace(/\{impersonate\}/g, encodeURIComponent(settings.impersonate))
        .replace(/\{timeout\}/g, String(Math.round(settings.timeoutMs)));
    default:
      return target;
  }
}

export interface FetchResult {
  ok: boolean;
  status: number;
  html: string;
  finalUrl: string;
  error?: string;
}

/**
 * Fetch a product page's HTML using the configured strategy.
 * `apiKey` is required for every non-direct provider.
 */
export async function fetchHtml(
  target: string,
  settings: ParserFetchSettings,
  apiKey: string,
): Promise<FetchResult> {
  const valid = validateTargetUrl(target, settings.provider);
  if ("error" in valid) {
    return { ok: false, status: 0, html: "", finalUrl: target, error: valid.error };
  }

  if (settings.provider !== "direct" && !apiKey) {
    return {
      ok: false,
      status: 0,
      html: "",
      finalUrl: target,
      error: `No API key configured for provider "${settings.provider}". Add one under Fetch & Anti-bot.`,
    };
  }
  if (settings.provider === "custom" && !settings.endpoint.includes("{url}")) {
    return {
      ok: false,
      status: 0,
      html: "",
      finalUrl: target,
      error: "Custom endpoint must contain a {url} placeholder.",
    };
  }

  const requestUrl =
    settings.provider === "direct"
      ? target
      : buildProviderUrl(settings.provider, settings, target, apiKey);

  // For direct fetches, present a same-origin Referer — some soft anti-bot
  // setups reject requests that arrive with no referrer.
  let directHeaders: Record<string, string> | undefined;
  if (settings.provider === "direct") {
    directHeaders = browserHeaders(settings.impersonate);
    try { directHeaders.Referer = new URL(target).origin + "/"; } catch { /* ignore */ }
  }

  // One retry, and only where a retry is the actual fix. A rate limit says
  // "later" and names when; a 403 in `direct` mode is worth exactly one more
  // try under a different browser profile, since the profile is the only thing
  // about the request we can change. A timeout is never retried — it has
  // already spent its budget once, and this runs inside a function with a hard
  // ceiling on how long it may live.
  let attempt = 0;
  for (;;) {
    const result = await requestOnce(requestUrl, directHeaders, settings, target);
    if (result.ok || attempt >= 1) return result;
    attempt++;

    if (RETRY_STATUS.has(result.status)) {
      await sleep(Math.min(result.retryAfterMs ?? DEFAULT_RETRY_MS, MAX_RETRY_WAIT_MS));
      continue;
    }
    if (result.status === 403 && settings.provider === "direct" && directHeaders) {
      // Two things about the request can change, so both do: the browser we
      // claim to be, and whether we carry the cookie the store hands out.
      // A refusal usually hands it over itself — `Set-Cookie` beside the 403 is
      // the whole mechanism of a soft wall — and when it has, the front page is
      // a request that buys nothing. Only a wall that refuses silently is worth
      // knocking on the door for, and then only once per host.
      if (!cookieHeaderFor(target)) await warmUpOrigin(target, settings);
      directHeaders = {
        ...browserHeaders(otherProfile(settings.impersonate)),
        ...(directHeaders.Referer ? { Referer: directHeaders.Referer } : {}),
      };
      continue;
    }
    return result;
  }
}

/** Statuses that mean "ask again shortly" rather than "no". */
const RETRY_STATUS = new Set([429, 503]);
const DEFAULT_RETRY_MS = 1_000;
const MAX_RETRY_WAIT_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The profile to try when the first one is refused. */
function otherProfile(impersonate: string): string {
  return impersonate === "safari" ? "chrome" : "safari";
}

/** `Retry-After` in either of its two legal forms: seconds, or a date. */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

async function requestOnce(
  requestUrl: string,
  headers: Record<string, string> | undefined,
  settings: ParserFetchSettings,
  target: string,
): Promise<FetchResult & { retryAfterMs?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, settings.timeoutMs));
  const direct = settings.provider === "direct";
  try {
    const cookie = direct && headers ? cookieHeaderFor(target) : "";
    const res = await fetch(requestUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      // Browser headers only matter for `direct`; providers set their own.
      headers: cookie && headers ? { ...headers, Cookie: cookie } : headers,
    });
    if (direct) rememberCookies(target, res);
    const html = await res.text();
    // Only a direct fetch can report a meaningful final URL. In provider mode
    // `res.url` is the SCRAPING SERVICE's endpoint, and using it would resolve
    // every relative link and image against the provider's domain instead of the
    // store's — so the target URL stands.
    const finalUrl = settings.provider === "direct" ? res.url || target : target;
    return {
      ok: res.ok,
      status: res.status,
      html,
      finalUrl,
      error: res.ok ? undefined : `Upstream responded ${res.status}`,
      retryAfterMs: retryAfterMs(res.headers.get("retry-after")),
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      html: "",
      finalUrl: target,
      error: aborted ? `Timed out after ${settings.timeoutMs}ms` : (err instanceof Error ? err.message : "Fetch failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** What a byte-for-byte fetch answers with. `bytes` is null unless `ok`. */
export interface BinaryResult {
  ok: boolean;
  status: number;
  bytes: Uint8Array | null;
  error?: string;
}

/**
 * Fetch a URL as bytes rather than text — for the one thing a shop publishes
 * compressed: `sitemap.xml.gz`.
 *
 * `direct` only, and deliberately. A scraping provider answers with the body it
 * decided to hand back, usually decoded as text; a gzip stream run through that
 * comes out as mojibake that no unzip will recover, and pretending otherwise
 * would report a readable sitemap as corrupt. The caller skips gzipped
 * candidates in provider mode instead.
 */
export async function fetchBinary(
  target: string,
  settings: ParserFetchSettings,
): Promise<BinaryResult> {
  if (settings.provider !== "direct") {
    return { ok: false, status: 0, bytes: null, error: "Binary fetch is direct-mode only" };
  }
  const valid = validateTargetUrl(target, settings.provider);
  if ("error" in valid) return { ok: false, status: 0, bytes: null, error: valid.error };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, settings.timeoutMs));
  try {
    const headers: Record<string, string> = {
      ...browserHeaders(settings.impersonate),
      Accept: "application/xml,text/xml,application/gzip,*/*;q=0.8",
    };
    const cookie = cookieHeaderFor(target);
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
    rememberCookies(target, res);
    if (!res.ok) {
      return { ok: false, status: res.status, bytes: null, error: `Upstream responded ${res.status}` };
    }
    return { ok: true, status: res.status, bytes: new Uint8Array(await res.arrayBuffer()) };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      bytes: null,
      error: aborted ? `Timed out after ${settings.timeoutMs}ms` : (err instanceof Error ? err.message : "Fetch failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}
