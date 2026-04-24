import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { requireAdmin } from "@/lib/server/admin-auth";

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

  const prompt = `You are writing a newsletter email for GOO — a minimal, sophisticated fashion discovery app.

Write an email body in plain text with light markdown formatting:
- Use # for main heading, ## for section headings
- Use - for bullet lists
- Use **bold** for emphasis
- Keep paragraphs short
- Tone: warm, minimal, editorial. Like a fashion insider talking to a friend.
- Length: 150–250 words. No fluff.

${subject ? `Email subject: ${subject}` : ""}
${brief ? `Brief / key points to cover: ${brief}` : ""}

Return ONLY the email body text, no subject line, no greeting like "Dear user", start directly with the content.`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.75,
    max_tokens: 600,
  });

  const body = completion.choices[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ body });
}
