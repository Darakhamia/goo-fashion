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
    const { description, url, section, reporter, priority } = await req.json();

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    // Step 1: Structure bug via Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze this bug report and return ONLY a JSON object with:
- title: short bug title in Russian (max 60 chars)
- steps: array of 2-4 reproduction steps in Russian
- expected: expected behavior in Russian
- actual: actual behavior in Russian
- priority: urgent/high/medium/low

Bug: ${description}
URL: ${url || "не указан"}
Section: ${section}
Priority: ${priority}`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse Claude response" }, { status: 500 });
    }
    const structured: ClaudeResult = JSON.parse(jsonMatch[0]);

    // Step 2: Create issue in Plane
    const stepsHtml = structured.steps.map((s: string) => `<li>${s}</li>`).join("");
    const descriptionHtml = `<p><b>Шаги:</b></p><ol>${stepsHtml}</ol><p><b>Ожидалось:</b> ${structured.expected}</p><p><b>Фактически:</b> ${structured.actual}</p><p><b>Репортер:</b> ${reporter}</p><p><b>URL:</b> ${url || "не указан"}</p>`;

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
      console.error("Plane API error:", planeError);
      return NextResponse.json({ error: "Failed to create Plane issue", details: planeError }, { status: 500 });
    }

    const planeIssue = await planeRes.json();

    return NextResponse.json({ structured, planeIssue });
  } catch (err) {
    console.error("report-bug error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
