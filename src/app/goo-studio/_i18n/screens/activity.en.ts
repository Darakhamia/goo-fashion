import type { Message } from "../en";

/** Activity (GS4-12). Keys start with "activity." unless shared with the core dictionary. */
export const activityEn = {
  "activity.count": { one: "{count} action", other: "{count} actions" },
  "activity.admins": { one: "{count} admin", other: "{count} admins" },
  "activity.refresh": "Refresh",
  "activity.denied": "Only the super admin can see the activity log.",
  "activity.loadFailed": "Could not load the activity log.",

  // Filters
  "activity.f.admin": "Admin",
  "activity.f.type": "Type",
  "activity.allAdmins": "All admins",
  "activity.allTypes": "All types",

  // The log, by day
  "activity.today": "Today",
  "activity.yesterday": "Yesterday",
  "activity.loadMore": "Load more",
  "activity.empty.none": "No activity yet. Admin actions show up here.",
  "activity.empty.filtered": "No actions match these filters.",
} as const satisfies Record<string, Message>;
