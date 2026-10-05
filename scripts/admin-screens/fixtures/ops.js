// Fixtures for the "ops" admin pages: dashboard, users, subscriptions,
// waitlist, email, activity. Data mirrors the real state described in
// docs/ADMIN_UX_REVIEW_2026-10.md (14 users incl. 2 team, overdue "active"
// subscription without a card, pending Pro, renewal cron never ran, ...).
// All people and addresses are fake (example.com).
const { products, IMG, TOTAL_PRODUCTS } = require("./catalog.js");

const NOW = Date.parse("2026-10-05T12:00:00Z");
const H = 3600e3;
const D = 24 * H;
const iso = (t) => new Date(t).toISOString();
const at = (s) => Date.parse(s);

// ── Users (Clerk) ────────────────────────────────────────────────────────────
const SUPER_ID = "user_harness_admin"; // same id _common.js returns from /api/admin/me
const TEAM_ID = "user_2rT5yU8iO1pA3sD6fG9hJ2kL4z";

// Clerk default avatars cannot be reproduced offline; the harness placeholder
// SVG looks like a square in a circle, so every user falls back to initials.
const avatar = () => "";

// Newest first, like Clerk's orderBy -created_at.
const USERS = [
  { id: "user_33nV8pLq2wXc5RtY7uIo9aSd1F", firstName: "Lena", lastName: "Moroz", email: "lena.moroz@example.com", img: "#c4b5a5",
    createdAt: at("2026-10-04T08:12:00Z"), lastSignInAt: NOW - 3 * H, lastActiveAt: NOW - 2 * H, plan: "free" },
  { id: "user_33kP0oI9uY8tR7eW6qA5sD4fG3", firstName: null, lastName: null, email: "k.petrenko@example.com", img: "",
    createdAt: at("2026-10-01T17:40:00Z"), lastSignInAt: at("2026-10-01T17:40:00Z"), lastActiveAt: at("2026-10-02T09:10:00Z"), plan: "free" },
  { id: "user_33dB7nM6vC5xZ4lK3jH2gF1dS0", firstName: "Daniel", lastName: "Brooks", email: "daniel.brooks@example.com", img: "",
    createdAt: at("2026-09-27T14:03:00Z"), lastSignInAt: NOW - 4 * D, lastActiveAt: NOW - 4 * D, plan: "free" },
  { id: "user_32zQ1wE2rT3yU4iO5pA6sD7fG8", firstName: "Sofia", lastName: "Ivanenko", email: "sofia.ivanenko@example.com", img: "#8b7d6b",
    createdAt: at("2026-09-20T10:25:00Z"), lastSignInAt: NOW - 1 * D, lastActiveAt: NOW - 20 * H, plan: "basic" },
  { id: "user_32xH9jK8lZ7xC6vB5nM4qW3eR2", firstName: "Oleh", lastName: "Shevchuk", email: "oleh.shevchuk@example.com", img: "",
    createdAt: at("2026-09-14T19:51:00Z"), lastSignInAt: NOW - 9 * D, lastActiveAt: NOW - 9 * D, plan: "free" },
  { id: "user_32sA1nN2aL3yY4sS5eE6nN7kK8", firstName: "Anna", lastName: "Lysenko", email: "anna.lysenko@example.com", img: "#a3a3a3",
    createdAt: at("2026-09-02T07:30:00Z"), lastSignInAt: NOW - 2 * D, lastActiveAt: NOW - 2 * D, plan: "premium" },
  { id: "user_32mT1uU2rR3nN4eE5rR6xX7yY8", firstName: "Max", lastName: "Turner", email: "max.turner@example.com", img: "",
    createdAt: at("2026-08-28T12:00:00Z"), lastSignInAt: at("2026-08-28T12:00:00Z"), lastActiveAt: null, plan: "free" },
  { id: "user_32gS7tT6yY5lL4eE3lL2oO1vV0", firstName: null, lastName: null, email: "style.lover@example.com", img: "",
    createdAt: at("2026-08-19T21:14:00Z"), lastSignInAt: at("2026-08-20T08:02:00Z"), lastActiveAt: at("2026-08-20T08:30:00Z"), plan: "free" },
  { id: "user_32bI9rR8yY7nN6aA5bB4oO3nN2", firstName: "Iryna", lastName: "Bondar", email: "iryna.bondar@example.com", img: "#6b7280",
    createdAt: at("2026-08-12T16:45:00Z"), lastSignInAt: NOW - 6 * D, lastActiveAt: NOW - 6 * D, plan: "pro" },
  { id: TEAM_ID, firstName: "Maria", lastName: "Koval", email: "maria.koval@example.com", img: "#9ca3af",
    createdAt: at("2026-07-30T09:00:00Z"), lastSignInAt: NOW - 5 * H, lastActiveAt: NOW - 40 * 60e3, plan: "basic",
    isAdmin: true, twoFactorEnabled: true,
    // Overdue since Sep 10, no card, still "active" — the 1.1 finding.
    subscription: { plan: "basic", status: "active", amountUah: 399, autoRenew: true, maskedPan: null,
      startedAt: "2026-08-10T11:20:00Z", currentPeriodEnd: "2026-09-10T11:20:00Z" } },
  { id: "user_2zT0oO9mM8bB7eE6cC5kK4eE3r", firstName: "Tom", lastName: "Becker", email: "tom.becker@example.com", img: "",
    createdAt: at("2026-07-21T13:37:00Z"), lastSignInAt: at("2026-07-22T10:00:00Z"), lastActiveAt: at("2026-07-22T10:05:00Z"), plan: "free" },
  { id: "user_2yY1uU2lL3iI4aA5sS6aA7vV8c", firstName: "Yulia", lastName: "Savchenko", email: "yulia.savchenko@example.com", img: "#b8a99a",
    createdAt: at("2026-07-02T06:18:00Z"), lastSignInAt: NOW - 33 * D, lastActiveAt: NOW - 33 * D, plan: "free" },
  { id: "user_2wQ1aA2tT3eE4sS5tT6aA7cC8c", firstName: "QA", lastName: "Test", email: "qa.test@example.com", img: "",
    createdAt: at("2026-06-19T15:00:00Z"), lastSignInAt: at("2026-06-19T15:00:00Z"), lastActiveAt: at("2026-06-19T15:10:00Z"), plan: "free" },
  { id: SUPER_ID, firstName: "Alex", lastName: "Grant", email: "admin@example.com", img: "#57534e",
    createdAt: at("2026-05-12T09:00:00Z"), lastSignInAt: NOW - 1 * H, lastActiveAt: NOW - 2 * 60e3, plan: "premium",
    isAdmin: true, adminViaEnv: true, isSuperAdmin: true, twoFactorEnabled: true, username: "alexg",
    // Pro checkout started from the team account and never completed.
    subscription: { plan: "pro", status: "pending", amountUah: 999, autoRenew: true, maskedPan: null,
      startedAt: "2026-09-28T18:02:00Z", currentPeriodEnd: null } },
];

const userRow = (u) => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  imageUrl: u.img ? avatar(u.id, u.img) : "",
  createdAt: u.createdAt,
  lastSignInAt: u.lastSignInAt,
  lastActiveAt: u.lastActiveAt,
  banned: false,
  locked: false,
  plan: u.plan,
  isAdmin: !!u.isAdmin,
  adminViaEnv: !!u.adminViaEnv,
  isSuperAdmin: !!u.isSuperAdmin,
  subscription: u.subscription ?? null,
});

const userDetail = (u) => ({
  ...userRow(u),
  username: u.username ?? null,
  updatedAt: u.lastSignInAt ?? u.createdAt,
  twoFactorEnabled: !!u.twoFactorEnabled,
  subscription: u.subscription ?? null,
});

const LIMITS = { free: 20, basic: 50, pro: 150, premium: null };
const userStats = (u, i) => {
  const lim = LIMITS[u.plan] ?? 20;
  const today = u.id === TEAM_ID ? 7 : i % 3 === 0 ? 2 : 0;
  return {
    stylistMsgToday: today,
    stylistMsgTotal: u.id === TEAM_ID ? 184 : 6 + ((i * 17) % 60),
    stylistLimitDay: lim,
    stylistRemaining: lim === null ? null : Math.max(0, lim - today),
    imagesGenerated: u.id === TEAM_ID ? 23 : (i * 3) % 9,
    looksPublished: u.id === TEAM_ID ? 4 : i % 4 === 0 ? 1 : 0,
  };
};

function listUsers({ url }) {
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const plan = url.searchParams.get("plan");
  const status = url.searchParams.get("status");
  const limit = Number(url.searchParams.get("limit")) || 50;
  const offset = Number(url.searchParams.get("offset")) || 0;
  const match = USERS.filter((u) =>
    (!q || [u.firstName, u.lastName, u.email].filter(Boolean).join(" ").toLowerCase().includes(q)) &&
    (!plan || u.plan === plan) &&
    (!status || status === "active"));
  return {
    users: match.slice(offset, offset + limit).map(userRow),
    totalCount: match.length,
    limit, offset, partial: false, subscriptionsError: null,
  };
}

function userById({ url, method }) {
  const m = url.pathname.match(/^\/api\/admin\/users\/([^/]+)(\/[^/]+)?$/);
  const idx = USERS.findIndex((u) => u.id === (m && m[1]));
  if (idx < 0) return { __status: 404, __body: { error: "User not found" } };
  const u = USERS[idx];
  if (m[2] === "/stats") return userStats(u, idx);
  if (m[2] === "/stylist-usage") return { ok: true };
  if (method === "DELETE") return { ok: true, autoRenewDisabled: false };
  return userDetail(u);
}

const planCounts = USERS.reduce((acc, u) => ((acc[u.plan] = (acc[u.plan] || 0) + 1), acc), {});

// ── Dashboard ────────────────────────────────────────────────────────────────
const outfitImg = (n, hex) => IMG("outfit-" + n, hex, "Outfit");
const recentOutfits = [
  ["o-51b", "Outfit 51", "#3f3f46", 5 * H],
  ["o-51a", "Outfit 51", "#78716c", 5.2 * H],
  ["o-50", "Outfit 50", "#a8a29e", 1 * D + 3 * H],
  ["o-49", "Outfit 49", "#1e3a8a", 2 * D],
  ["o-48", "Outfit 48", "#d6d3d1", 4 * D],
  ["o-47", "Outfit 47", "#57534e", 6 * D],
].map(([id, name, hex, ago]) => ({ id: "8f2b6c1e-" + id, name, image_url: outfitImg(id, hex), created_at: iso(NOW - ago) }));

// GET /api/admin/stats (GS4-12): the state of prod in the review — renewals
// never ran, 12 migrations missing (so AI check's table is absent too), one
// overdue cardless subscription, 940 products without an embedding, four looks
// to moderate. Payments on: the token is set, so the cron and billing count.
const customers = USERS.filter((u) => !u.isAdmin);
const stats = {
  generatedAt: iso(NOW - 20e3),
  paymentsOff: false,
  kpis: {
    products: { total: TOTAL_PRODUCTS, thisMonth: 659, pct: null },
    outfits: { total: 27, ai: 19, pending: 4 },
    customers: { total: customers.length, team: USERS.length - customers.length, partial: false, thisMonth: 2, pct: null },
    paying: { total: 1, mrrUah: 399 },
    brands: { total: 72, products: TOTAL_PRODUCTS },
  },
  attention: [
    {
      key: "cron", tone: "err", href: "/goo-studio/subscriptions",
      fix: [
        "Coolify → the app → Scheduled Tasks: billing-renew, 0 9 * * *",
        'curl -fsS --max-time 300 -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}/api/billing/cron/renew"',
        "CRON_SECRET set in the app's environment (BILLING.md)",
      ],
    },
    {
      key: "migrations", tone: "err", count: 12, href: "/goo-studio/settings#schema",
      fix: [
        "007_embeddings_openai_1536.sql", "009_user_looks_share.sql", "012_label_audit_dismissals.sql", "015_product_bg_color.sql",
        "017_pending_look_details.sql", "018_retailer_domains.sql", "019_product_price_usd.sql", "019_product_source_price.sql",
        "020_product_codes.sql", "021_color_groups.sql", "023_product_crop_data.sql", "025_catalogue_check.sql",
      ].map((m) => `supabase/migrations/${m}`),
    },
    { key: "overdue", tone: "warn", count: 1, href: "/goo-studio/subscriptions" },
    { key: "noCard", tone: "warn", count: 1, href: "/goo-studio/subscriptions" },
    { key: "embeddings", tone: "warn", count: 940, href: "/goo-studio/settings#embeddings" },
    { key: "pendingLooks", tone: "warn", count: 4, href: "/goo-studio/outfits" },
  ],
  services: [
    { key: "supabase", state: "ok", code: "answered", ms: 86 },
    { key: "clerk", state: "ok", code: "answered", ms: 214 },
    { key: "openai", state: "ok", code: "answered", ms: 182 },
    { key: "replicate", state: "ok", code: "answered", ms: 301 },
    { key: "resend", state: "ok", code: "send_only" },
    { key: "monobank", state: "ok", code: "answered", ms: 240 },
    { key: "cron", state: "err", code: "never_ran" },
  ],
  recent: {
    customers: customers.slice(0, 5).map((u) => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
      imageUrl: u.img ? avatar(u.id, u.img) : "", createdAt: u.createdAt, plan: u.plan,
    })),
    // The harness signs in as the super admin, so the catalogue's log shows.
    activity: [
      { id: 905, action: "products.updated", name: "Athleticz oversized T-shirt", count: null, who: "maria.koval@example.com", at: iso(NOW - 5 * 60e3) },
      { id: 904, action: "parser.collect_ingest", name: "zara.com", count: 48, who: "maria.koval@example.com", at: iso(NOW - 25 * 60e3) },
      { id: 903, action: "import.csv", name: "Awin feed · Selfridges", count: 37, who: "admin@example.com", at: iso(NOW - 3 * H) },
      { id: 902, action: "catalogue_check.applied", name: null, count: 7, who: "admin@example.com", at: iso(NOW - 26 * H) },
      { id: 901, action: "products.deleted", name: "Moon Boot dog toy", count: null, who: "maria.koval@example.com", at: iso(NOW - 30 * H) },
    ],
    outfits: recentOutfits,
  },
};

// The same dashboard on a good day, and with payments switched off (no
// MONOBANK_TOKEN): monobank and the cron grey "Off", no billing items.
const statsHealthy = {
  ...stats,
  attention: [],
  services: stats.services.map((s) => (s.key === "cron" ? { key: "cron", state: "ok", code: "ran", at: iso(NOW - 3 * H) } : s)),
};
const statsPaymentsOff = {
  ...stats,
  paymentsOff: true,
  attention: stats.attention.filter((a) => !["cron", "overdue", "noCard", "failedCharges"].includes(a.key)),
  services: stats.services.map((s) => (s.key === "cron" || s.key === "monobank" ? { key: s.key, state: "off", code: "off" } : s)),
};

// ── Subscriptions ────────────────────────────────────────────────────────────
const subscriptions = {
  summary: {
    mrrUah: 399,
    activeSubscriptions: 1,
    pastDue: 0,
    canceled: 0,
    pending: 1,
    autoRenewOff: 0,
    activeWithoutCard: 1,
    overdue: 1,
    failedCharges: 0,
    lastCronRunAt: null,
    hoursSinceCronRun: null,
    earnedTotalUah: 399,
    earnedThisMonthUah: 0,
    paymentsTotal: 1,
    byPlan: [{ plan: "basic", count: 1, mrrUah: 399 }],
    eventsAvailable: true,
    eventsError: null,
    usdUahRate: 41,
  },
  subscriptions: [
    { userId: SUPER_ID, email: "admin@example.com", plan: "pro", status: "pending", amountUah: 999, autoRenew: true,
      maskedPan: null, hasCardToken: false, failedCharges: 0, overdue: false, currentPeriodEnd: null },
    { userId: TEAM_ID, email: "maria.koval@example.com", plan: "basic", status: "active", amountUah: 399, autoRenew: true,
      maskedPan: null, hasCardToken: false, failedCharges: 0, overdue: true, currentPeriodEnd: "2026-09-10T11:20:00Z" },
  ],
  transactions: [
    { id: 9, email: "admin@example.com", eventType: "checkout_started", kind: "initial", plan: "pro", amountUah: 999,
      status: "created", detail: "Invoice 2509281802aQx created, waiting for payment", createdAt: "2026-09-28T18:02:00Z" },
    { id: 8, email: "admin@example.com", eventType: "checkout_started", kind: "initial", plan: "pro", amountUah: 999,
      status: "expired", detail: null, createdAt: "2026-09-21T12:44:00Z" },
    { id: 7, email: "anna.lysenko@example.com", eventType: "checkout_started", kind: "initial", plan: "premium", amountUah: 1799,
      status: "expired", detail: null, createdAt: "2026-09-02T07:41:00Z" },
    { id: 6, email: "maria.koval@example.com", eventType: "card_token_missing", kind: "initial", plan: "basic", amountUah: null,
      status: null, detail: "Payment succeeded but the webhook carried no walletData.cardToken", createdAt: "2026-08-10T11:21:00Z" },
    { id: 5, email: "maria.koval@example.com", eventType: "payment_success", kind: "initial", plan: "basic", amountUah: 399,
      status: "success", detail: "Invoice 2508101120mKv", createdAt: "2026-08-10T11:20:00Z" },
    { id: 4, email: "maria.koval@example.com", eventType: "checkout_started", kind: "initial", plan: "basic", amountUah: 399,
      status: "created", detail: null, createdAt: "2026-08-10T11:18:00Z" },
    { id: 3, email: "iryna.bondar@example.com", eventType: "checkout_started", kind: "initial", plan: "pro", amountUah: 999,
      status: "expired", detail: null, createdAt: "2026-08-12T17:02:00Z" },
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
};

// ── Waitlist ─────────────────────────────────────────────────────────────────
const waitlist = [
  { id: "c2f1a7e4-6b1d-4f0a-9d3e-7a1b2c3d4e5f", email: "maria.koval@example.com", created_at: "2026-06-03T10:14:00Z" },
  { id: "a9e8d7c6-5b4a-4c3d-8e2f-1a0b9c8d7e6f", email: "admin@example.com", created_at: "2026-05-28T08:47:00Z" },
];

// ── Activity (audit log) ─────────────────────────────────────────────────────
// Two admins, each recorded under two Clerk ids → each email appears twice in
// the admin filter (the duplicate-pills finding).
const ADMINS = [
  { id: SUPER_ID, email: "admin@example.com" },
  { id: "user_2pK7wQhX9aLmN3bVcR5tYz8EuJ", email: "admin@example.com" },
  { id: TEAM_ID, email: "maria.koval@example.com" },
  { id: "user_33Ab7Cd9Ef1Gh3Ij5Kl7Mn9Op1", email: "maria.koval@example.com" },
];
const uuid = (n) => {
  const h = (x, len) => (Math.abs(Math.imul(x + 1, 2654435761)) >>> 0).toString(16).padStart(8, "0").repeat(2).slice(0, len);
  return `${h(n, 8)}-${h(n * 7, 4)}-4${h(n * 13, 3)}-a${h(n * 29, 3)}-${h(n * 31, 12)}`;
};

const ENTRIES = [];
{
  let id = 1692;
  let t = NOW - 14 * 60e3;
  const push = (admin, action, extra = {}) => {
    ENTRIES.push({
      id: id--, admin_id: admin.id, admin_email: admin.email, action,
      target_id: extra.target_id ?? null, target_type: extra.target_type ?? null,
      metadata: extra.metadata ?? {}, created_at: iso(t),
    });
  };
  const A = ADMINS[0], A2 = ADMINS[1], M = ADMINS[2], M2 = ADMINS[3];
  const zaraPaths = ["athleticz-oversized-t-shirt-p01887412", "twisted-wide-leg-pant-p02417110", "melrose-denim-pant-p06688020",
    "ribbed-knit-polo-p03284401", "boxy-fit-shirt-p01063300", "linen-blend-blazer-p02010725"];
  // Today: a collect run on zara.com, one product row per collected item.
  for (let i = 0; i < 18; i++) {
    push(M, "parser.collect_ingest", { target_type: "product", target_id: uuid(i),
      metadata: { url: `https://www.zara.com/ua/en/${zaraPaths[i % zaraPaths.length]}.html`, status: i % 5 === 3 ? "updated" : "created" } });
    t -= (40 + (i % 4) * 15) * 1e3;
  }
  t -= 35 * 60e3;
  push(A, "products.updated", { target_type: "product", target_id: products[5].id,
    metadata: { name: products[5].name, brand: products[5].brand } });
  t -= 4 * 60e3;
  push(A, "products.updated", { target_type: "product", target_id: products[8].id, metadata: { fields: ["crop_data"] } });
  t -= 22 * 60e3;
  push(A, "brands.created", { target_type: "brand", target_id: "72", metadata: { name: "Z" } });
  t -= 2 * H;
  push(A2, "settings.prompt_updated", { target_type: "prompt", target_id: "stylist_system", metadata: { key: "stylist_system" } });
  t -= 30 * 60e3;
  push(A2, "user.plan_changed", { target_type: "user", target_id: USERS[5].id, metadata: { from: "free", to: "premium" } });
  t -= 3 * H;
  for (let i = 18; i < 32; i++) {
    push(M2, "parser.collect_ingest", { target_type: "product", target_id: uuid(i),
      metadata: { url: `https://www.zara.com/ua/en/${zaraPaths[i % zaraPaths.length]}.html`, status: "created" } });
    t -= (35 + (i % 3) * 20) * 1e3;
  }
  t -= 1 * D;
  push(A, "products.bg_color_sampled", { target_type: "product", metadata: { count: 212 } });
  t -= 10 * 60e3;
  push(A, "catalogue_check.applied", { target_type: "product", metadata: { count: 37 } });
  t -= 2 * H;
  push(A2, "products.deleted", { target_type: "product", target_id: uuid(90), metadata: { name: "Moon Boot dog toy" } });
  t -= 40 * 60e3;
  push(M, "outfits.created", { target_type: "outfit", target_id: "8f2b6c1e-o-51b", metadata: { name: "Outfit 51" } });
  t -= 2 * 60e3;
  push(M, "outfits.created", { target_type: "outfit", target_id: "8f2b6c1e-o-51a", metadata: { name: "Outfit 51" } });
  t -= 5 * H;
  push(A, "settings.api_key_updated", { target_type: "setting", metadata: { key: "openai_api_key" } });
  t -= 3 * H;
  push(A, "email.sent", { target_type: "email", metadata: { subject: "Welcome to GOO", audience: "custom", sent: 1 } });
  t -= 1 * D;
  for (let i = 32; i < 40; i++) {
    push(M, "parser.product_imported", { target_type: "product", target_id: uuid(i),
      metadata: { sourceUrl: `https://www.nike.com/fr/t/produit-${i}`, updated: false } });
    t -= 70e3;
  }
}

function audit({ url }) {
  const limit = Number(url.searchParams.get("limit")) || 50;
  const offset = Number(url.searchParams.get("offset")) || 0;
  const adminId = url.searchParams.get("admin_id");
  const action = url.searchParams.get("action");
  const match = ENTRIES.filter((e) => (!adminId || e.admin_id === adminId) && (!action || e.action === action));
  const filtered = !!(adminId || action);
  return {
    entries: match.slice(offset, offset + limit),
    total: filtered ? match.length : 1692,
    ...(offset === 0 ? { admins: ADMINS } : {}),
  };
}

// ── Email ────────────────────────────────────────────────────────────────────
const emailStatus = {
  configured: true,
  fromAddress: "GOO Fashion <hello@example.com>",
  counts: { all: USERS.length, free: planCounts.free, basic: planCounts.basic, pro: planCounts.pro, premium: planCounts.premium },
};

module.exports = {
  routes: {
    "GET /api/admin/stats": stats,

    "GET /api/admin/users": listUsers,
    "GET /api/admin/users/counts": {
      total: USERS.length, premium: planCounts.premium, pro: planCounts.pro, basic: planCounts.basic,
      free: planCounts.free, banned: 0, partial: false, scanned: USERS.length, scanCap: 2000,
    },
    "GET /api/admin/users/*": userById,
    "* /api/admin/users/*": userById,

    "GET /api/admin/subscriptions": subscriptions,

    "GET /api/admin/waitlist": waitlist,
    "DELETE /api/admin/waitlist": { ok: true },

    "GET /api/admin/email": emailStatus,
    "GET /api/admin/email/templates": [],
    "POST /api/admin/email": ({ body }) => ({ ok: true, sent: body && body.testOnly ? 1 : USERS.length, total: body && body.testOnly ? 1 : USERS.length, testOnly: !!(body && body.testOnly) }),

    "GET /api/admin/audit": audit,
  },
  pages: [
    // GS4-12 Dashboard: "How to fix" open on the first item; the dashboard on a
    // good day ("All good"); and with payments switched off.
    {
      name: "dashboard-fix", url: "/goo-studio", fullPage: false,
      after: async (page) => {
        // On a phone the rows are links and "How to fix" stays on a computer.
        await page.getByText("Needs attention", { exact: true }).waitFor();
        const fix = page.locator("section li button[aria-expanded]").first();
        if (await fix.count()) await fix.click();
        await page.waitForTimeout(300);
      },
    },
    ...[["dashboard-healthy", statsHealthy], ["dashboard-payments-off", statsPaymentsOff]].map(([name, body]) => ({
      name, url: "/goo-studio",
      after: async (page) => {
        await page.route("**/api/admin/stats*", (r) => r.fulfill({ json: body }));
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(800);
      },
    })),
    {
      name: "users-drawer",
      url: "/goo-studio/users",
      after: async (page) => {
        await page.getByText("Maria Koval", { exact: true }).first().click();
        await page.getByRole("dialog").waitFor({ timeout: 15000 });
        await page.getByText("Stylist today").waitFor({ timeout: 15000 });
        await page.waitForTimeout(600);
      },
    },
    // GS4-4: two users ticked and the plan menu of the selection bar open.
    {
      name: "users-bulk",
      url: "/goo-studio/users",
      fullPage: false,
      after: async (page) => {
        // Row boxes by place, not by label: the label is in the admin's language.
        // On a phone the photo is the box (GS4-11): the hidden input is clicked through it.
        const boxes = page.locator('[data-row] input[type="checkbox"]');
        await boxes.first().waitFor({ state: "attached", timeout: 15000 });
        await boxes.nth(0).check({ force: true });
        await boxes.nth(1).check({ force: true });
        await page.getByRole("toolbar").locator('button[aria-haspopup="menu"]').click();
        await page.waitForTimeout(300);
      },
    },
    {
      name: "email-confirm",
      url: "/goo-studio/email",
      after: async (page) => {
        await page.getByPlaceholder("e.g. New features in GOO this month").fill("New in GOO: autumn edit and a smarter stylist");
        await page.locator("textarea").first().fill(
          "# Autumn is here\n\nWe added 659 new pieces this month, from knitwear to outerwear.\n\n## What's new\n\n- **Autumn edit** — hand-picked layers for cooler days\n- The AI stylist now remembers your sizes\n- Save looks to your profile\n\nSee you on GOO,\nThe GOO team"
        );
        await page.getByRole("button", { name: /^Send to 14 recipients$/ }).click();
        await page.getByText(/people\?/).waitFor({ timeout: 10000 });
      },
    },
    {
      // Account menu open: theme, language (GS4-8), Customize, back to site.
      // Found by aria-controls, so the state works in either language.
      name: "account-menu",
      url: "/goo-studio",
      fullPage: false,
      after: async (page) => {
        await page.locator('button[aria-controls="admin-account-menu"]').click();
        await page.locator("#admin-account-menu").waitFor();
        await page.waitForTimeout(300);
      },
    },
  ],
};
