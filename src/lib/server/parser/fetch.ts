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

/**
 * Block direct fetches to internal / loopback / link-local addresses (SSRF
 * defence). Only applied in `direct` mode — provider modes fetch from their own
 * infrastructure, not ours.
 */
export function isBlockedDirectHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) {
    return true;
  }
  // IPv6 loopback / unique-local
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  // IPv4 private / loopback / link-local / metadata
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
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
      return settings.endpoint
        .replace(/\{url\}/g, enc)
        .replace(/\{key\}/g, encodeURIComponent(apiKey))
        .replace(/\{render\}/g, settings.renderJs ? "true" : "false");
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, settings.timeoutMs));
  try {
    const res = await fetch(requestUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      // Browser headers only matter for `direct`; providers set their own.
      headers: settings.provider === "direct" ? browserHeaders(settings.impersonate) : undefined,
    });
    const html = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      html,
      finalUrl: res.url || target,
      error: res.ok ? undefined : `Upstream responded ${res.status}`,
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
