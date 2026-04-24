import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/server/get-openai-key";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
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
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
    }

    const { text: pageText, ogImage } = await fetchPageText(url);

    const client = new OpenAI({ apiKey });

    const systemPrompt = `You are a fashion blog writer for GOO — a smart, minimal fashion discovery app.
Write engaging, concise fashion blog posts in a modern editorial tone.
Always respond with valid JSON only, no markdown, no code blocks.`;

    const userPrompt = `Here is content scraped from this URL: ${url}

---
${pageText}
---

Based on this content, write a GOO fashion blog post. Return a JSON object with these fields:
- title: string (catchy, editorial, 6-10 words)
- excerpt: string (1-2 sentences teaser, max 200 chars)
- body: string (500-800 words, HTML format with <p>, <h2>, <ul>/<li> tags. Engaging, fashion-forward. Mention specific items, trends, or styling tips from the source.)
- category: string (one of: "Trends", "Style Guide", "Brands", "Smart Shopping", "How-to", "News", "AI Stylist")
- metaTitle: string (SEO title, max 60 chars)
- metaDescription: string (SEO description, max 155 chars)
- slug: string (URL-friendly, e.g. "spring-2025-color-trends")

Keep the tone minimal, sophisticated, and practical. Write as if for a design-conscious millennial audience.`;

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
