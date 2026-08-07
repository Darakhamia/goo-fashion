import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 10 messages per IP per sliding minute window.
// Safe for casual public use; increase if needed for authenticated heavy users.
const REQUESTS_PER_MINUTE = 10;

// Daily cap for unauthenticated users (per IP). Signed-in users get per-plan
// limits via STYLIST_DAILY_LIMITS instead; without this an anonymous visitor
// could burn AI tokens indefinitely at the per-minute rate.
const ANON_REQUESTS_PER_DAY = 25;

// Module-level singletons — created once per serverless function instance.
// null when UPSTASH env vars are absent (dev / unconfigured deployments).
let ratelimit: Ratelimit | null = null;
let anonDailyLimit: Ratelimit | null = null;
// Shared connection, so limiters added later (see checkNamedRateLimit) don't
// each open their own.
let redisClient: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  redisClient = redis;
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(REQUESTS_PER_MINUTE, "1 m"),
    analytics: false,
    prefix: "goo:stylist",
  });
  anonDailyLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(ANON_REQUESTS_PER_DAY, "1 d"),
    analytics: false,
    prefix: "goo:stylist:anon-daily",
  });
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Requests left in the window after this check; null when the limiter is off. */
  remaining: number | null;
  /** Window size of this limiter; null when the limiter is off. */
  limit: number | null;
}

// Prefer x-forwarded-for for real client IP behind proxies / Vercel edge
function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
}

async function runLimit(
  limiter: Ratelimit | null,
  key: string,
  windowSize: number
): Promise<RateLimitResult> {
  if (!limiter) {
    // Upstash not configured — passthrough (safe for dev / internal deployments)
    return { allowed: true, retryAfterSeconds: 0, remaining: null, limit: null };
  }
  try {
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      retryAfterSeconds: result.success
        ? 0
        : Math.ceil((result.reset - Date.now()) / 1000),
      remaining: Math.max(0, result.remaining),
      limit: windowSize,
    };
  } catch (err) {
    // If the Upstash call itself fails (network blip, quota, etc.),
    // allow the request rather than blocking all users.
    console.warn("[rate-limit] Upstash error, allowing request:", err);
    return { allowed: true, retryAfterSeconds: 0, remaining: null, limit: null };
  }
}

export async function checkRateLimit(req: Request): Promise<RateLimitResult> {
  return runLimit(ratelimit, clientIp(req), REQUESTS_PER_MINUTE);
}

/** Daily cap for unauthenticated users — call only when there is no userId. */
export async function checkAnonDailyLimit(req: Request): Promise<RateLimitResult> {
  return runLimit(anonDailyLimit, clientIp(req), ANON_REQUESTS_PER_DAY);
}

// Buckets for endpoints other than the stylist. Each name gets its own Redis
// prefix, so filing a bug report cannot eat someone's stylist allowance and
// vice versa. Built lazily and cached — a serverless instance only pays for
// the limiters the routes it actually served asked for.
const namedLimiters = new Map<string, Ratelimit>();

export interface NamedRateLimit {
  /** Redis prefix for this bucket — keep it stable, it is the storage key. */
  name: string;
  requests: number;
  window: Duration;
  /** What to count per: a userId where there is one, otherwise the client IP. */
  key?: string | null;
}

export async function checkNamedRateLimit(
  req: Request,
  { name, requests, window, key }: NamedRateLimit,
): Promise<RateLimitResult> {
  if (!redisClient) return { allowed: true, retryAfterSeconds: 0, remaining: null, limit: null };

  let limiter = namedLimiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(requests, window),
      analytics: false,
      prefix: `goo:${name}`,
    });
    namedLimiters.set(name, limiter);
  }

  return runLimit(limiter, key || clientIp(req), requests);
}
