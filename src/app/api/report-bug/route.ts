import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ClaudeResult {
  title: string;
  steps: string[];
  expected: string;
  actual: string;
  priority: string;
}

export async function POST(req: NextRequest) {
  try {
    const { description, url, section, reporter, priority, screenshotBase64, screenshotMime } =
      await req.json();

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

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

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

    const content: ContentBlock[] = [];

    if (screenshotBase64 && screenshotMime) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: screenshotMime, data: screenshotBase64 },
      });
    }
    content.push({ type: "text", text: textPrompt });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
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
