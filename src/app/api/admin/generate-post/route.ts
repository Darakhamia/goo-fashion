import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { getPrompt } from "@/lib/server/get-prompt";
import { slugify } from "@/lib/blog-render";
import { assertPublicUrl, validateTargetUrl } from "@/lib/server/parser/fetch";
import { readCappedText } from "@/lib/server/read-capped";
import {
  DEFAULT_BLOG_SYSTEM_PROMPT,
  DEFAULT_BLOG_USER_PROMPT,
  DEFAULT_BLOG_BRIEF_PROMPT,
} from "@/lib/server/prompt-defaults";

/** Enough for a paragraph of notes, short of a prompt-injection payload. */
const BRIEF_MIN = 12;
const BRIEF_MAX = 4000;

/**
 * Response budget. The URL prompt asks for 500–800 words of HTML plus six
 * JSON fields; at 1500 a longer article got its JSON cut mid-string.
 */
const MAX_COMPLETION_TOKENS = 3000;

/** Redirect hops followed for an article URL; each one passes the address check. */
const MAX_REDIRECTS = 5;

/**
 * Most of an article page that is read. Only 6,000 characters of text are kept
 * anyway; the cap is what stops a huge or gzip-bombed body from filling the
 * memory of the one process the whole site runs in.
 */
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/**
 * Fetch the article page an admin pasted, following redirects by hand.
 *
 * The server makes this request and the page text comes back in the draft, so
 * every address it dials — the first and each redirect hop — must be public and
 * resolve only to public addresses. Otherwise a pasted link, or a public page
 * answering "302 → http://kong:8000/", reads our own network into the editor
 * (and into OpenAI). The timeout covers the whole chain, body included.
 */
async function fetchPageText(url: string): Promise<{ text: string; ogImage?: string }> {
  const signal = AbortSignal.timeout(10_000);
  let current = url;
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const r = await fetch(current, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GOO-Bot/1.0)" },
      signal,
      redirect: "manual",
    });
    const location = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
    if (!location) {
      res = r;
      break;
    }
    r.body?.cancel().catch(() => undefined); // free the socket of the hop left behind
    current = new URL(location, current).toString();
  }
  if (!res) throw new Error("Too many redirects");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await readCappedText(res, MAX_PAGE_BYTES);

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
    // Spelling only, so a typo or a literal internal address gets a useful
    // answer at once. What the name resolves to is checked when it is fetched.
    if (hasUrl && "error" in validateTargetUrl(url, "direct")) {
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

    // Only the URL mode reaches out to the network. Every way that can fail —
    // a refused address or redirect, a closed port, an error status, a timeout —
    // gets the same answer: telling them apart would let this form map which
    // internal ports are open. The detail goes to the server log.
    let scraped: { text: string; ogImage?: string } = { text: "" };
    if (hasUrl) {
      try {
        scraped = await fetchPageText(url);
      } catch (err) {
        console.error("[generate-post] could not fetch the page:", url, err);
        return NextResponse.json({ error: "Could not fetch the page" }, { status: 502 });
      }
    }
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

    // JSON mode rejects the request unless the messages say "JSON". The stock
    // prompts do; a prompt rewritten in Settings may not, and then plain text
    // with the extraction fallback below beats a hard 400.
    const mentionsJson = /json/i.test(systemPrompt) || /json/i.test(userPrompt);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: MAX_COMPLETION_TOKENS,
      ...(mentionsJson ? { response_format: { type: "json_object" as const } } : {}),
    });

    const choice = completion.choices[0];
    if (choice?.finish_reason === "length") {
      // A cut-off reply is half a JSON object — say so instead of "could not parse".
      return NextResponse.json(
        { error: "The AI response was cut off before the post was finished. Try again, or use a shorter source." },
        { status: 502 }
      );
    }

    const raw = choice?.message?.content ?? "";
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
