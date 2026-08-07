import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Billing alerts — the "somebody should know" channel for money problems.
 *
 * Everything in here is best-effort and must never throw: an alert failing to
 * send cannot be allowed to fail a renewal sweep or a payment webhook. When it
 * cannot send, it says so on the console, which is the fallback of last resort.
 *
 * Recipients are the admins the project already knows about: BILLING_ALERT_EMAIL
 * if set (comma-separated), otherwise the Clerk accounts listed in
 * ADMIN_USER_IDS. No new configuration is required for this to work.
 */

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "GOO Fashion <hello@goo-fashion.com>";

async function alertRecipients(): Promise<string[]> {
  const override = (process.env.BILLING_ALERT_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
  if (override.length > 0) return override;

  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminIds.length === 0) return [];

  try {
    const cc = await clerkClient();
    const list = await cc.users.getUserList({ userId: adminIds, limit: adminIds.length });
    return list.data
      .map((u) => u.emailAddresses[0]?.emailAddress)
      .filter((e): e is string => !!e && e.includes("@"));
  } catch (err) {
    console.error(
      `[billing-alert] could not resolve admin emails from Clerk: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(subject: string, lines: string[]): { html: string; text: string } {
  const body = lines
    .map((l) => `<p style="margin:0 0 8px;color:#333;line-height:1.6;">${esc(l)}</p>`)
    .join("\n");
  return {
    text: `${subject}\n${"=".repeat(subject.length)}\n\n${lines.join("\n")}\n\n— goo-fashion.com billing`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f9f9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;padding:32px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e8e8e4;">
      <tr><td style="padding:24px 32px;border-bottom:1px solid #f0f0ec;">
        <span style="font-family:Georgia,serif;font-size:22px;font-weight:300;letter-spacing:0.2em;color:#0a0a0a;">GOO</span>
        <span style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#999;margin-left:12px;">Billing alert</span>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0a0a0a;">${esc(subject)}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #f0f0ec;background:#fafaf8;">
        <p style="margin:0;font-size:11px;color:#aaa;">Automated message from goo-fashion.com billing. Details in /goo-studio/subscriptions.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  };
}

/**
 * Send an alert to the billing admins. Returns whether anything was sent —
 * callers may record that, but must not depend on it.
 */
export async function sendBillingAlert(subject: string, lines: string[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  // The alert still has to reach a human somehow, so an unsendable alert is
  // printed in full rather than dropped.
  const dump = () => console.error(`[billing-alert] ${subject} :: ${lines.join(" | ")}`);

  if (!apiKey) {
    console.error("[billing-alert] RESEND_API_KEY is not set — alert not emailed.");
    dump();
    return false;
  }

  const to = await alertRecipients();
  if (to.length === 0) {
    console.error("[billing-alert] no recipients (set BILLING_ALERT_EMAIL or ADMIN_USER_IDS).");
    dump();
    return false;
  }

  const { html, text } = render(subject, lines);
  try {
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `[GOO billing] ${subject}`,
      html,
      text,
    });
    // The SDK reports API-level rejections in `error` rather than by throwing.
    if (res.error) {
      console.error(`[billing-alert] Resend rejected the send: ${res.error.message}`);
      dump();
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[billing-alert] send threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    dump();
    return false;
  }
}
