import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { getPrompt } from "@/lib/server/get-prompt";
import {
  DEFAULT_BLOG_SYSTEM_PROMPT,
  DEFAULT_BLOG_USER_PROMPT,
  DEFAULT_BLOG_BRIEF_PROMPT,
} from "@/lib/server/prompt-defaults";

/** Enough for a paragraph of notes, short of a prompt-injection payload. */
const BRIEF_MIN = 12;
const BRIEF_MAX = 4000;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

/**
 * SSRF guard: only allow public http(s) URLs — reject internal hostnames and
 * private/link-local IP ranges so the server can't be used to probe
 * infrastructure (cloud metadata endpoints, internal services).
 */
function isAllowedExternalUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // IPv6 literals (URL keeps brackets in hostname for them)
  if (host.startsWith("[")) return false;
  // Private / loopback / link-local IPv4 ranges
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "0.0.0.0"
  ) {
    return false;
  }
  return true;
}

async function fetchPageText(url: string): Promise<{ text: string; ogImage?: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GOO-Bot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
  const html = await res.text();

  // Extract og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const ogImage = ogMatch?.[1];

  // Strip scripts, styles, nav, footer, ads
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000); // Keep within token limits

  return { text: stripped, ogImage };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { url, brief } = await req.json();

    // Two modes. `url` rewrites someone else's article into an editorial post;
    // `brief` turns a few lines from the team into a product post, where there
    // is no page to scrape and no og:image to inherit.
    const hasUrl = typeof url === "string" && url.trim().length > 0;
    const hasBrief = typeof brief === "string" && brief.trim().length > 0;

    if (hasUrl === hasBrief) {
      return NextResponse.json(
        { error: "Send either url or brief, not both and not neither" },
        { status: 400 }
      );
    }
    if (hasUrl && !isAllowedExternalUrl(url)) {
      return NextResponse.json({ error: "url must be a public http(s) address" }, { status: 400 });
    }
    if (hasBrief) {
      const len = brief.trim().length;
      if (len < BRIEF_MIN) {
        return NextResponse.json(
          { error: `brief is too short — at least ${BRIEF_MIN} characters` },
          { status: 400 }
        );
      }
      if (len > BRIEF_MAX) {
        return NextResponse.json(
          { error: `brief is too long — at most ${BRIEF_MAX} characters` },
          { status: 413 }
        );
      }
    }

    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
    }

    // Only the URL mode reaches out to the network.
    const scraped = hasUrl ? await fetchPageText(url) : { text: "", ogImage: undefined };
    const ogImage = scraped.ogImage;

    // 60s cap so a stuck completion can't hold the serverless function open
    const client = new OpenAI({ apiKey, timeout: 60_000 });

    const [systemPrompt, userPromptTemplate] = await Promise.all([
      getPrompt("prompt_blog_system", DEFAULT_BLOG_SYSTEM_PROMPT),
      hasUrl
        ? getPrompt("prompt_blog_user", DEFAULT_BLOG_USER_PROMPT)
        : getPrompt("prompt_blog_brief", DEFAULT_BLOG_BRIEF_PROMPT),
    ]);

    const userPrompt = hasUrl
      ? userPromptTemplate.replace("{{url}}", url).replace("{{content}}", scraped.text)
      : userPromptTemplate.replace("{{brief}}", brief.trim());

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from the response if it contains extra text
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse AI response as JSON");
      parsed = JSON.parse(match[0]);
    }

    return NextResponse.json({
      title: parsed.title ?? "",
      slug: parsed.slug ? slugify(parsed.slug) : slugify(parsed.title ?? ""),
      excerpt: parsed.excerpt ?? "",
      body: parsed.body ?? "",
      category: parsed.category ?? "",
      metaTitle: parsed.metaTitle ?? "",
      metaDescription: parsed.metaDescription ?? "",
      coverImageUrl: ogImage ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
