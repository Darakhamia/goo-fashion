import type { Message } from "../en";

/** Users (GS4-12). Keys start with "users." unless shared with the core dictionary. */
export const usersEn = {
  // Said when a request failed without a reason of its own.
  "users.loadFailed": "Could not load",

  // Lists and subscription summaries inside confirms and warnings.
  "users.list.more": "{list} and {count} more",
  "users.subStatus.active": "Active",
  "users.subStatus.pending": "Pending",
  "users.subStatus.canceled": "Canceled",
  "users.sub.autoRenewOn": "Auto-renew on",
  "users.sub.autoRenewOff": "Auto-renew off",
  "users.duration.lessThanDay": "Less than a day",
  "users.duration.days": { one: "{count} day", other: "{count} days" },
  "users.duration.months": { one: "{count} month", other: "{count} months" },
  "users.duration.years": { one: "{count} year", other: "{count} years" },

  // What a plan change or a delete does to billing.
  "users.note.planBilling": "Only the plan in Clerk changes; billing does not.",
  "users.note.renewal": "Charges continue, and the next renewal restores the paid plan.",
  "users.note.pastDue": "Its last renewal failed and is not retried, so nothing puts the paid plan back on its own.",
  "users.note.deleteAccount": "This permanently removes the Clerk account.",
  "users.note.deleteSub":
    "This user has an active subscription ({sub}). Auto-renew is turned off before the account is deleted, so the saved card is not charged again.",
  "users.confirm.planPaying": {
    one: "{count} of them has an active subscription ({list}).",
    other: "{count} of them have an active subscription ({list}).",
  },
  "users.confirm.deletePaying": {
    one: "{count} of them has an active subscription ({list}). Auto-renew is turned off before each account is deleted, so saved cards are not charged again.",
    other: "{count} of them have an active subscription ({list}). Auto-renew is turned off before each account is deleted, so saved cards are not charged again.",
  },

  // The side panel.
  "users.panel.protected": "Super admin: this account is protected and cannot be changed.",
  "users.panel.noEmail": "No email",
  "users.panel.updated": "Updated",
  "users.panel.lastSignIn": "Last sign-in",
  "users.panel.twoFactor": "2FA",
  "users.panel.twoFactorOn": "Enabled",
  "users.panel.twoFactorOff": "Disabled",
  "users.panel.username": "Username",
  "users.panel.subscription": "Subscription",
  "users.panel.subscribedFor": "Subscribed for",
  "users.panel.since": "Since",
  "users.panel.nextCharge": "Next charge",
  "users.panel.accessUntil": "Access until",
  "users.panel.autoRenew": "Auto-renew",
  "users.panel.on": "On",
  "users.panel.off": "Off",
  "users.panel.card": "Card",
  "users.panel.noSubscription": "Never subscribed: the plan is free or set by hand.",
  "users.panel.activity": "Activity",
  "users.panel.statsUnavailable": "Stats unavailable.",
  "users.panel.statsUnavailableWith": "Stats unavailable: {error}",
  "users.panel.profile": "Profile",
  "users.panel.firstName": "First name",
  "users.panel.lastName": "Last name",
  "users.panel.activeSub": "Active subscription ({sub}).",
  "users.panel.access": "Access",
  "users.panel.admin": "Admin",
  "users.panel.adminViaEnv": "Granted via env (ADMIN_USER_IDS). Remove the id there to revoke.",
  "users.panel.viaEnv": "Via env",
  "users.panel.adminHint": "Gives access to /goo-studio. Only a super admin can change this.",
  "users.panel.superAdminOnly": "Only a super admin can change this.",
  "users.panel.adminOn": "Enabled",
  "users.panel.banned": "Banned",
  "users.panel.bannedHint": "Stops the user from signing in.",

  // Activity numbers in the side panel. The stand waits for "Stylist today".
  "users.stats.stylistToday": "Stylist today",
  "users.stats.unlimited": "Unlimited",
  "users.stats.left": "{count} left",
  "users.stats.stylistTotal": "Stylist total",
  "users.stats.messages": { one: "message sent", other: "messages sent" },
  "users.stats.images": "AI images",
  "users.stats.generated": "generated",
  "users.stats.looks": "Looks",
  "users.stats.published": "published",
  "users.stylist.resetToday": "Reset today’s limit",
  "users.stylist.resetAll": "Reset all-time",
  "users.stylist.resetAllTitle": "Delete this user’s entire AI Stylist message history?",
  "users.stylist.resetAllBody":
    "It also disappears from the AI usage chart in Analytics and cannot be undone. To lift today’s limit, “{action}” is enough.",
  "users.stylist.resetAllAction": "Delete message history",
  "users.stylist.statsStale": "Usage was reset, but the stats could not be refreshed.",
  "users.stylist.resetFailed": "Could not reset usage",
} as const satisfies Record<string, Message>;
