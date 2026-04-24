import { NextResponse } from "next/server";
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "GOO Fashion <hello@goo-fashion.com>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Convert plain-text body with basic markdown-ish formatting into simple HTML.
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

// Strip markdown to clean plain text for the text/plain part required by Resend
function buildPlainText(text: string, subject: string): string {
  const body = text
    .replace(/^## (.+)$/gm, "\n$1\n" + "-".repeat(30))
    .replace(/^# (.+)$/gm, "\n$1\n" + "=".repeat(30))
    .replace(/^\* (.+)$/gm, "• $1")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
  return `GOO Fashion\n${"=".repeat(40)}\n${subject}\n${"=".repeat(40)}\n\n${body}\n\n---\nYou received this email because you have an account on goo-fashion.com.\n© ${new Date().getFullYear()} GOO Fashion. All rights reserved.`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, `<code style="background:#f4f4f4;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:13px;">$1</code>`);
}

function buildHtml(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e8e4;">
        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0ec;">
          <span style="font-family:Georgia,serif;font-size:26px;font-weight:300;letter-spacing:0.2em;color:#0a0a0a;">GOO</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          ${bodyHtml}
        </td></tr>
        <!-- Footer -->
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

// Fetch emails from Clerk by audience segment
async function resolveRecipients(
  audience: string,
  customEmails: string[]
): Promise<string[]> {
  if (audience === "custom") {
    return customEmails.filter((e) => e.includes("@")).slice(0, 500);
  }

  const cc = await clerkClient();
  const result = await cc.users.getUserList({ limit: 500, orderBy: "-created_at" });
  let users = result.data;

  if (audience !== "all") {
    users = users.filter((u) => {
      const plan = ((u.publicMetadata ?? {}) as { plan?: string }).plan ?? "free";
      return plan === audience;
    });
  }

  return users
    .map((u) => u.emailAddresses[0]?.emailAddress)
    .filter((e): e is string => !!e && e.includes("@"));
}

// POST /api/admin/email
// { audience, subject, body, customEmails?, testOnly? }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured. Add it to your environment variables." },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const { audience, subject, body: text, customEmails = [], testOnly = false } = body as {
    audience: string;
    subject: string;
    body: string;
    customEmails?: string[];
    testOnly?: boolean;
  };

  if (!subject?.trim()) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!text?.trim())    return NextResponse.json({ error: "Body is required." }, { status: 400 });
  if (!audience)        return NextResponse.json({ error: "Audience is required." }, { status: 400 });

  // Resolve recipients
  let recipients: string[];
  if (testOnly) {
    // Send only to the admin who triggered it
    const cc = await clerkClient();
    const user = await cc.users.getUser(admin.userId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return NextResponse.json({ error: "No email on admin account." }, { status: 400 });
    recipients = [email];
  } else {
    recipients = await resolveRecipients(audience, customEmails);
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found for the selected audience." }, { status: 400 });
  }

  const bodyHtml = textToHtml(text);
  const html = buildHtml(subject, bodyHtml);
  const plainText = buildPlainText(text, subject.trim());
  const resend = new Resend(RESEND_API_KEY);

  // Send individually so recipients cannot see each other's addresses.
  // Resend batch API supports up to 100 sends per call.
  const BATCH = 100;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    try {
      await resend.batch.send(
        batch.map((to) => ({
          from: FROM_ADDRESS,
          to: [to],
          subject: subject.trim(),
          html,
          text: plainText,
        }))
      );
      sent += batch.length;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Batch send failed");
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    sent,
    total: recipients.length,
    errors: errors.length > 0 ? errors : undefined,
    testOnly,
  });
}

// GET /api/admin/email — return config status + audience counts
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = !!RESEND_API_KEY;
  const fromAddress = FROM_ADDRESS;

  // Get rough audience counts from Clerk
  let counts: Record<string, number> = { all: 0, free: 0, basic: 0, pro: 0, premium: 0 };
  try {
    const cc = await clerkClient();
    const result = await cc.users.getUserList({ limit: 500, orderBy: "-created_at" });
    counts.all = result.data.length;
    for (const u of result.data) {
      const plan = ((u.publicMetadata ?? {}) as { plan?: string }).plan ?? "free";
      counts[plan] = (counts[plan] ?? 0) + 1;
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ configured, fromAddress, counts });
}
