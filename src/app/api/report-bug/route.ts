import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";

// This route spends money on someone else's behalf: it hands user-supplied text
// and an image straight to the Anthropic API. Left open it is a faucet anyone
// on the internet can turn on, so it is gated three ways — sign-in, a per-user
// hourly cap, and hard limits on how much text and image a single call may
// carry. The description and screenshot caps are what bound the token cost of
// one accepted request; the hourly cap bounds how many of those a person gets.
const REPORTS_PER_HOUR = 5;
const MAX_DESCRIPTION_CHARS = 4_000;
// ~3.6 MB of image once decoded, comfortably under Anthropic's own 5 MB ceiling.
const MAX_SCREENSHOT_BASE64_CHARS = 5_000_000;

interface ClaudeResult {
  title: string;
  steps: string[];
  expected: string;
  actual: string;
  priority: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to report a bug." }, { status: 401 });
    }

    const limit = await checkNamedRateLimit(req, {
      name: "report-bug",
      requests: REPORTS_PER_HOUR,
      window: "1 h",
      key: userId,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many bug reports. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const { description, url, section, reporter, priority, screenshotBase64, screenshotMime } =
      await req.json();

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }
    if (typeof description !== "string" || description.length > MAX_DESCRIPTION_CHARS) {
      return NextResponse.json(
        { error: `Description must be under ${MAX_DESCRIPTION_CHARS} characters.` },
        { status: 413 },
      );
    }
    if (typeof screenshotBase64 === "string" && screenshotBase64.length > MAX_SCREENSHOT_BASE64_CHARS) {
      return NextResponse.json({ error: "Screenshot is too large." }, { status: 413 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Without the key the Anthropic client throws on construction, which used
      // to surface as an unexplained 500. Say what is actually wrong instead.
      console.error("report-bug: ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        { error: "Bug reporting is not configured on this deployment." },
        { status: 503 },
      );
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const textPrompt = `Analyze this bug report and return ONLY a JSON object with:
- title: short bug title in Russian (max 60 chars)
- steps: array of 2-4 reproduction steps in Russian
- expected: expected behavior in Russian
- actual: actual behavior in Russian
- priority: urgent/high/medium/low

Bug: ${description}
URL: ${url || "не указан"}
Section: ${section}
Priority: ${priority}`;

    const validMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ValidMime = (typeof validMimes)[number];

    const messageContent: MessageParam["content"] = [];

    if (screenshotBase64 && screenshotMime && validMimes.includes(screenshotMime as ValidMime)) {
      messageContent.push({
        type: "image",
        source: { type: "base64", media_type: screenshotMime as ValidMime, data: screenshotBase64 },
      });
    }
    messageContent.push({ type: "text", text: textPrompt });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: messageContent }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Claude raw response:", rawText);
      return NextResponse.json({ error: "Failed to parse Claude response", raw: rawText }, { status: 500 });
    }

    let structured: ClaudeResult;
    try {
      structured = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "raw:", jsonMatch[0]);
      return NextResponse.json({ error: "Invalid JSON from Claude" }, { status: 500 });
    }

    const stepsHtml = structured.steps.map((s: string) => `<li>${s}</li>`).join("");
    const screenshotNote = screenshotBase64 ? `<p><b>Скриншот:</b> прикреплён к репорту</p>` : "";
    const descriptionHtml = `<p><b>Шаги:</b></p><ol>${stepsHtml}</ol><p><b>Ожидалось:</b> ${structured.expected}</p><p><b>Фактически:</b> ${structured.actual}</p><p><b>Репортер:</b> ${reporter}</p><p><b>URL:</b> ${url || "не указан"}</p>${screenshotNote}`;

    const planeRes = await fetch(
      "https://plane.goo-fashion.com/api/v1/workspaces/goo-fashion/projects/5daa7410-231b-434b-a220-f230079dbc35/issues/",
      {
        method: "POST",
        headers: {
          "X-Api-Key": process.env.PLANE_API_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: structured.title,
          description_html: descriptionHtml,
          priority: structured.priority,
        }),
      },
    );

    if (!planeRes.ok) {
      const planeError = await planeRes.text();
      console.error("Plane API error:", planeRes.status, planeError);
      return NextResponse.json(
        { error: `Plane API error ${planeRes.status}`, details: planeError },
        { status: 500 },
      );
    }

    const planeIssue = await planeRes.json();
    return NextResponse.json({ structured, planeIssue });
  } catch (err) {
    console.error("report-bug unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
