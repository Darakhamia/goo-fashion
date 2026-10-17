/**
 * Crawlers goo-fashion turns away (CEO, 2026-10-17: protect the server from
 * load; let in search engines, link previews, AI search and our own services).
 *
 * Read by robots.ts, which asks them to stay off the whole site, and by
 * proxy.ts, which answers 403 to any that come anyway. They are the ones that
 * fetch a lot and bring no visitors: AI training crawlers and SEO-tool
 * crawlers. Everything not listed is let through, notably:
 *   - search engines — Googlebot, bingbot, Applebot, DuckDuckBot, YandexBot;
 *   - link previews — facebookexternalhit, TelegramBot, Twitterbot, WhatsApp,
 *     Viber, LinkedInBot, Slackbot, Discordbot;
 *   - AI search, which cites pages and sends people — OAI-SearchBot,
 *     ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot,
 *     Claude-User, meta-externalfetcher;
 *   - our own: monobank's webhooks and the Coolify tasks (curl on localhost).
 * Generic clients (curl, python-requests, Go-http-client) are never listed:
 * the bank and our tasks may use them. Bots that lie about who they are are
 * Cloudflare's job (docs/CLOUDFLARE.md).
 *
 * Matched case-insensitively as a whole token of the User-Agent, so
 * "ClaudeBot" does not catch "Claude-SearchBot".
 */

/** robots.txt groups that disallow everything; `ua: false` marks a robots.txt-only token with no User-Agent of its own. */
export const BLOCKED_BOTS: { token: string; ua?: false }[] = [
  // AI training crawlers
  { token: "GPTBot" },
  { token: "ClaudeBot" },
  { token: "anthropic-ai" },
  { token: "CCBot" },
  { token: "Bytespider" },
  { token: "meta-externalagent" },
  { token: "FacebookBot" },
  { token: "Amazonbot" },
  { token: "cohere-ai" },
  { token: "cohere-training-data-crawler" },
  { token: "Diffbot" },
  { token: "ImagesiftBot" },
  { token: "Timpibot" },
  { token: "omgili" },
  { token: "omgilibot" },
  { token: "img2dataset" },
  { token: "AI2Bot" },
  { token: "PanguBot" },
  // Opt-outs from AI training that the search crawlers read; they have no UA.
  { token: "Google-Extended", ua: false },
  { token: "Applebot-Extended", ua: false },
  // SEO-tool crawlers: heavy, and not a source of visitors
  { token: "AhrefsBot" },
  { token: "SemrushBot" },
  { token: "MJ12bot" },
  { token: "DotBot" },
  { token: "DataForSeoBot" },
  { token: "BLEXBot" },
  { token: "serpstatbot" },
  { token: "Barkrowler" },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const BLOCKED_UA = new RegExp(
  `(?:^|[^a-z0-9])(?:${BLOCKED_BOTS.filter((b) => b.ua !== false)
    .map((b) => escape(b.token))
    .join("|")})(?:[^a-z0-9]|$)`,
  "i",
);

/** Whether a request's User-Agent belongs to one of BLOCKED_BOTS. */
export function isBlockedBot(userAgent: string | null): boolean {
  return !!userAgent && BLOCKED_UA.test(userAgent);
}
