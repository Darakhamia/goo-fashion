import { NextResponse } from "next/server";
import { Resend } from "resend";
import { clerkClient, type User } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { buildHtml, buildPlainText, footerKindFor, parseEmailList, textToHtml } from "@/lib/email-render";

// A large audience is sent in many batches; give the loop room to finish.
export const maxDuration = 300;

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "GOO Fashion <hello@goo-fashion.com>";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/** Clerk's page-size ceiling for getUserList. */
const CLERK_PAGE = 500;

// Every Clerk user, newest first. getUserList returns at most 500 per call,
// so walk the pages by offset until totalCount is reached. Someone signing up
// mid-walk shifts every later page by one, so the last user of a page comes
// back as the first of the next: users are kept by id, once each.
async function listAllUsers(): Promise<User[]> {
  const cc = await clerkClient();
  const users = new Map<string, User>();
  for (let offset = 0; ; offset += CLERK_PAGE) {
    const res = await cc.users.getUserList({ limit: CLERK_PAGE, offset, orderBy: "-created_at" });
    for (const u of res.data) users.set(u.id, u);
    if (res.data.length < CLERK_PAGE || users.size >= res.totalCount) break;
  }
  return [...users.values()];
}

function planOf(u: User): string {
  return ((u.publicMetadata ?? {}) as { plan?: string }).plan ?? "free";
}

// Fetch emails from Clerk by audience segment
async function resolveRecipients(
  audience: string,
  customEmails: string[]
): Promise<string[]> {
  if (audience === "custom") {
    // Validate and de-duplicate on the server too — the list comes from the client.
    return parseEmailList(customEmails.join("\n")).emails;
  }

  let users = await listAllUsers();

  if (audience !== "all") {
    users = users.filter((u) => planOf(u) === audience);
  }

  // One letter per address, whatever its case.
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const u of users) {
    const email = u.emailAddresses[0]?.emailAddress;
    if (!email || !email.includes("@") || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    emails.push(email);
  }
  return emails;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    customEmails?: unknown;
    testOnly?: boolean;
  };

  if (!subject?.trim()) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!text?.trim())    return NextResponse.json({ error: "Body is required." }, { status: 400 });
  if (!audience)        return NextResponse.json({ error: "Audience is required." }, { status: 400 });

  const customList = Array.isArray(customEmails)
    ? customEmails.filter((e): e is string => typeof e === "string")
    : [];

  // Resolve recipients
  let recipients: string[];
  try {
    if (testOnly) {
      // Send only to the admin who triggered it
      const cc = await clerkClient();
      const user = await cc.users.getUser(admin.userId);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) return NextResponse.json({ error: "No email on admin account." }, { status: 400 });
      recipients = [email];
    } else {
      recipients = await resolveRecipients(audience, customList);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Could not load recipients from Clerk: ${message}` }, { status: 502 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found for the selected audience." }, { status: 400 });
  }

  // The test email carries the same footer the chosen audience would get.
  const footer = footerKindFor(audience);
  const html = buildHtml(subject, textToHtml(text), footer);
  const plainText = buildPlainText(text, subject.trim(), footer);
  const resend = new Resend(RESEND_API_KEY);

  // Send individually so recipients cannot see each other's addresses.
  // Resend batch API supports up to 100 sends per call.
  const BATCH = 100;
  // Resend rate-limits API calls per second; pace the batches of a large send.
  const BATCH_PAUSE_MS = 600;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const range = recipients.length > BATCH ? `Recipients ${i + 1}–${i + batch.length}: ` : "";
    if (i > 0) await sleep(BATCH_PAUSE_MS);
    try {
      // Resend v6 does not throw on an API error — it resolves with { error }.
      const res = await resend.batch.send(
        batch.map((to) => ({
          from: FROM_ADDRESS,
          to: [to],
          subject: subject.trim(),
          html,
          text: plainText,
        }))
      );
      if (res.error) {
        errors.push(`${range}${res.error.message}`);
      } else {
        sent += batch.length;
      }
    } catch (e) {
      errors.push(`${range}${e instanceof Error ? e.message : "Batch send failed"}`);
    }
  }

  // A test goes to the sender alone; only a real send is an action to record.
  if (!testOnly) {
    await logAdminAction({
      admin_id: admin.userId,
      action: "email.sent",
      target_type: "email_broadcast",
      metadata: {
        audience,
        subject: subject.trim(),
        sent,
        total: recipients.length,
        failedBatches: errors.length,
      },
    });
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

  // Audience counts from Clerk. On failure report countsError instead of
  // zeros, so the page can say the audience is unknown rather than empty.
  let counts: Record<string, number> | null = null;
  let countsError: string | undefined;
  try {
    const users = await listAllUsers();
    counts = { all: users.length, free: 0, basic: 0, pro: 0, premium: 0 };
    for (const u of users) {
      const plan = planOf(u);
      counts[plan] = (counts[plan] ?? 0) + 1;
    }
  } catch (e) {
    countsError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ configured, fromAddress, counts, countsError });
}
