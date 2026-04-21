import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, `<code style="background:#f4f4f4;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:13px;">$1</code>`);
}

function textToHtml(text: string): string {
  const lines = text.split("\n");
  const parts: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push(`<h2 style="margin:24px 0 8px;font-size:18px;font-weight:600;color:#0a0a0a;">${esc(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push(`<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#0a0a0a;">${esc(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) { parts.push('<ul style="margin:8px 0;padding-left:20px;">'); inList = true; }
      parts.push(`<li style="margin:4px 0;color:#555;">${inlineFormat(esc(line.slice(2)))}</li>`);
    } else if (line === "") {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push('<div style="height:12px;"></div>');
    } else {
      if (inList) { parts.push("</ul>"); inList = false; }
      parts.push(`<p style="margin:0 0 8px;color:#333;line-height:1.6;">${inlineFormat(esc(line))}</p>`);
    }
  }
  if (inList) parts.push("</ul>");
  return parts.join("\n");
}

function buildHtml(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e8e4;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0ec;">
          <span style="font-family:Georgia,serif;font-size:26px;font-weight:300;letter-spacing:0.2em;color:#0a0a0a;">GOO</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #f0f0ec;background:#fafaf8;">
          <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
            You received this email because you have an account on <a href="https://goo-fashion.com" style="color:#555;">goo-fashion.com</a>.<br>
            © ${new Date().getFullYear()} GOO Fashion. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { subject = "", body: text = "" } = body as { subject?: string; body?: string };
  const html = buildHtml(subject || "(no subject)", textToHtml(text || ""));

  return NextResponse.json({ html });
}
