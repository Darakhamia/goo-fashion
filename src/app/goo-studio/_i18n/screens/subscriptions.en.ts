import type { Message } from "../en";

/** Subscriptions (GS4-12). Keys start with "subs." unless shared with the core dictionary. */
export const subscriptionsEn = {
  "subs.subtitle": "monobank · charges in hryvnia · dollar amounts are approximate, at {rate} per $1",
  "subs.loadFailed": "Could not load subscriptions.",
  "subs.perMonth": "{amount}/mo",

  // Key numbers
  "subs.kpis": "Revenue and subscriptions",
  "subs.kpi.mrr": "MRR",
  "subs.kpi.active": "Active",
  "subs.kpi.overdue": "Overdue",
  "subs.kpi.pending": "Pending",
  "subs.kpi.pastDue": "Past due",
  "subs.kpi.earned": "Earned total",
  "subs.note.wontRenew": "{count} won't renew",
  "subs.note.since": "since {date}",
  "subs.note.pending": "checkout not finished",
  "subs.note.canceled": "{count} canceled",
  "subs.note.thisMonth": "{amount} this month",
  "subs.note.payments": { one: "{count} payment logged", other: "{count} payments logged" },

  // Needs attention: this page's own items, beside the core attn.* ones
  "subs.attn.eventsError.title": "Billing events could not be read",
  "subs.attn.eventsError.text": "{error}. Revenue totals, the renewal heartbeat and the transaction log are incomplete.",
  "subs.attn.noEvents.title": "The billing events table is not set up",
  "subs.attn.noEvents.text": "Revenue totals and the transaction log fill in once it exists and payments go through it.",
  "subs.attn.noCard.text":
    "Renewal skips it, so the customer keeps a paid plan for free. The daily cron retries the card lookup; if the number stays, the customer has to subscribe again.",

  // Subscribers
  "subs.subscribers": "Subscribers",
  "subs.subscribers.count": { one: "{count} subscription", other: "{count} subscriptions" },
  "subs.col.customer": "Customer",
  "subs.col.plan": "Plan",
  "subs.col.status": "Status",
  "subs.col.price": "Price",
  "subs.col.card": "Card",
  "subs.col.next": "Next renewal",
  "subs.status.active": "Active",
  "subs.status.overdue": "Overdue",
  "subs.status.past_due": "Past due",
  "subs.status.canceled": "Canceled",
  "subs.status.pending": "Pending",
  "subs.card.saved": "Saved",
  "subs.card.none": "No card",
  "subs.next.overdue": "Overdue since {date}",
  "subs.next.overdueHint": "The paid period ended and the renewal has not gone through",
  "subs.next.renews": "Renews {date}",
  "subs.next.ends": "Ends {date}",
  "subs.next.firstPayment": "After the first payment",
  "subs.failed": "{count} failed",
  "subs.failedHint": "Failed charges in a row; three move the customer to Free",
  "subs.empty.subscribers": "No subscribers yet.",

  // Transaction log
  "subs.log": "Transaction log",
  "subs.log.count": { one: "{count} event, newest first", other: "{count} events, newest first" },
  "subs.col.when": "When",
  "subs.col.event": "Event",
  "subs.col.amount": "Amount",
  "subs.col.detail": "Detail",
  "subs.event.payment_success": "Payment",
  "subs.event.payment_failed": "Failed",
  "subs.event.checkout_started": "Checkout",
  "subs.event.canceled": "Canceled",
  // Money moved but the subscription row did not: must not read as routine.
  "subs.event.ledger_error": "Ledger error",
  "subs.event.card_token_missing": "No card",
  "subs.event.card_token_recovered": "Card found",
  "subs.event.renewal_skipped": "Skipped",
  "subs.event.cron_run": "Cron ran",
  "subs.event.cron_misconfigured": "Cron broken",
  "subs.kind.renewal": "Renewal",
  "subs.empty.log": "No transactions logged yet.",
} as const satisfies Record<string, Message>;
