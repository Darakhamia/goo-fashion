import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { BLOCKED_BOTS } from "@/lib/bots";

/**
 * Disallow only what a crawler should never fetch. Pages that merely shouldn't
 * be indexed — /cart, /subscribe, /login, /register — carry `noindex` instead
 * and stay crawlable: a page blocked here can still be indexed from links to
 * it, because the crawler never gets to read its noindex.
 *
 * AI training and SEO-tool crawlers are asked to stay off entirely; proxy.ts
 * answers 403 to those that come anyway (lib/bots.ts). Search engines, link
 * previews and AI search keep the rules for everyone.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/goo-studio/",
          // Signed-in only: a crawler is sent to the sign-in host.
          "/saved",
          "/profile",
          // The app itself, ~4 MB of client code with nothing to index.
          "/builder",
        ],
      },
      {
        userAgent: BLOCKED_BOTS.map((b) => b.token),
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
