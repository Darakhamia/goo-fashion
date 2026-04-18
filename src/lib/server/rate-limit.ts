import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 10 messages per IP per sliding minute window.
// Safe for casual public use; increase if needed for authenticated heavy users.
const REQUESTS_PER_MINUTE = 10;

// Module-level singleton — created once per serverless function instance.
// null when UPSTASH env vars are absent (dev / unconfigured deployments).
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(REQUESTS_PER_MINUTE, "1 m"),
    analytics: false,
    prefix: "goo:stylist",
  });
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkRateLimit(req: Request): Promise<RateLimitResult> {
  if (!ratelimit) {
    // Upstash not configured — passthrough (safe for dev / internal deployments)
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Prefer x-forwarded-for for real client IP behind proxies / Vercel edge
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  try {
    const result = await ratelimit.limit(ip);
    return {
      allowed: result.success,
      retryAfterSeconds: result.success
        ? 0
        : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (err) {
    // If the Upstash call itself fails (network blip, quota, etc.),
    // allow the request rather than blocking all users.
    console.warn("[rate-limit] Upstash error, allowing request:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
