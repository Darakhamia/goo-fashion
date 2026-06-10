import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { getPrompt } from "@/lib/server/get-prompt";
import { DEFAULT_BLOG_SYSTEM_PROMPT, DEFAULT_BLOG_USER_PROMPT } from "@/lib/server/prompt-defaults";

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
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    if (!isAllowedExternalUrl(url)) {
      return NextResponse.json({ error: "url must be a public http(s) address" }, { status: 400 });
    }

    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
    }

    const { text: pageText, ogImage } = await fetchPageText(url);

    // 60s cap so a stuck completion can't hold the serverless function open
    const client = new OpenAI({ apiKey, timeout: 60_000 });

    const [systemPrompt, userPromptTemplate] = await Promise.all([
      getPrompt("prompt_blog_system", DEFAULT_BLOG_SYSTEM_PROMPT),
      getPrompt("prompt_blog_user", DEFAULT_BLOG_USER_PROMPT),
    ]);

    const userPrompt = userPromptTemplate
      .replace("{{url}}", url)
      .replace("{{content}}", pageText);

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
