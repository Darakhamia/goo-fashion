import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { buildHtml, footerKindFor, textToHtml } from "@/lib/email-render";

// The Email page now renders its preview in the browser with the same
// src/lib/email-render.ts helpers; this route no longer has a caller.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { subject = "", body: text = "", audience = "all" } = body as { subject?: string; body?: string; audience?: string };
  const html = buildHtml(subject || "(no subject)", textToHtml(text || ""), footerKindFor(audience));

  return NextResponse.json({ html });
}
