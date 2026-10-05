import type { Message } from "../en";

/** Waitlist (GS4-12). Keys start with "waitlist." unless shared with the core dictionary. */
export const waitlistEn = {
  "waitlist.title": "Waitlist",
  "waitlist.count": { one: "{count} email", other: "{count} emails" },
  "waitlist.archive": "an archive: the signup form was removed in September 2026",
  "waitlist.loadFailedShort": "Could not load the list",
  "waitlist.loadFailed": "Could not load the waitlist: {error}",
  "waitlist.httpError": "Request failed (HTTP {status}).",
  "waitlist.refresh": "Refresh",
  "waitlist.copyAll": "Copy all",
  "waitlist.copyHint": "Every address, one per line, to paste into an email tool",
  "waitlist.copied": { one: "Copied {count} email.", other: "Copied {count} emails." },
  "waitlist.copyFailed": "Could not copy: the browser blocked clipboard access.",
  "waitlist.col.email": "Email",
  "waitlist.col.signedUp": "Signed up",
  "waitlist.remove": "Remove {email}",
  "waitlist.confirm.title": "Remove {email} from the waitlist?",
  "waitlist.confirm.body": "This cannot be undone.",
  "waitlist.confirm.action": "Remove email",
  "waitlist.removeFailed": "Could not remove {email}: {error}",
  "waitlist.empty": "The waitlist is empty.",
} as const satisfies Record<string, Message>;
