import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getPrompt } from "@/lib/server/get-prompt";
import { DEFAULT_EMAIL_PROMPT } from "@/lib/server/prompt-defaults";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, brief } = await req.json().catch(() => ({}));
  if (!subject?.trim() && !brief?.trim()) {
    return NextResponse.json({ error: "subject or brief is required" }, { status: 400 });
  }

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  const client = new OpenAI({ apiKey });

  const template = await getPrompt("prompt_email", DEFAULT_EMAIL_PROMPT);
  const prompt = template
    .replace("{{subject}}", subject ? `Email subject: ${subject}` : "")
    .replace("{{brief}}", brief ? `Brief / key points to cover: ${brief}` : "");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.75,
    max_tokens: 600,
  });

  const body = completion.choices[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ body });
}
