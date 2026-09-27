// Pure helpers for the studio's email broadcast: the markdown-ish body → HTML
// renderer, the branded wrapper, the text/plain part and the recipient list
// parser. No server-only imports — the Email page renders its live preview
// with the same functions the send route uses, so the two cannot drift apart.

/**
 * Who the footer addresses. "account" — people picked from Clerk, who do have
 * an account. "custom" — a pasted list (e.g. the old waitlist), who may not.
 */
export type EmailFooterKind = "account" | "custom";

const FOOTER_NOTE: Record<EmailFooterKind, string> = {
  account: "You received this email because you have an account on goo-fashion.com.",
  custom: "This email was sent to you by GOO Fashion (goo-fashion.com).",
};

export function footerKindFor(audience: string): EmailFooterKind {
  return audience === "custom" ? "custom" : "account";
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function inlineFormat(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, `<code style="background:#f4f4f4;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:13px;">$1</code>`);
}

// Convert plain-text body with basic markdown-ish formatting into simple HTML.
export function textToHtml(text: string): string {
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

export function buildHtml(subject: string, bodyHtml: string, footer: EmailFooterKind = "account"): string {
  const note = esc(FOOTER_NOTE[footer]).replace(
    "goo-fashion.com",
    `<a href="https://goo-fashion.com" style="color:#555;">goo-fashion.com</a>`,
  );
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
            ${note}<br>
            © ${new Date().getFullYear()} GOO Fashion. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Strip markdown to clean plain text for the text/plain part required by Resend
export function buildPlainText(text: string, subject: string, footer: EmailFooterKind = "account"): string {
  const body = text
    .replace(/^## (.+)$/gm, "\n$1\n" + "-".repeat(30))
    .replace(/^# (.+)$/gm, "\n$1\n" + "=".repeat(30))
    .replace(/^\* (.+)$/gm, "• $1")
    .replace(/^- (.+)$/gm, "• $1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
  return `GOO Fashion\n${"=".repeat(40)}\n${subject}\n${"=".repeat(40)}\n\n${body}\n\n---\n${FOOTER_NOTE[footer]}\n© ${new Date().getFullYear()} GOO Fashion. All rights reserved.`;
}

// Deliberately loose: one "@", a domain of non-empty dot-separated labels, no
// spaces or separators. Resend rejects a whole batch over one malformed
// address, so anything that would not survive its validation is dropped.
const EMAIL_RE = /^[^\s@,;<>"]+@(?:[^\s@,;<>".]+\.)+[^\s@,;<>".]+$/;

/**
 * Split a pasted list (comma, semicolon or newline separated) into valid,
 * de-duplicated addresses (case-insensitive, first spelling wins).
 * `skipped` counts the entries that were dropped as invalid or repeated.
 */
export function parseEmailList(input: string): { emails: string[]; skipped: number } {
  const seen = new Set<string>();
  const emails: string[] = [];
  let skipped = 0;
  for (const raw of input.split(/[\n,;]/)) {
    const email = raw.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(key)) { skipped++; continue; }
    seen.add(key);
    emails.push(email);
  }
  return { emails, skipped };
}
