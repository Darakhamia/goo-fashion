import crypto from "node:crypto";

/**
 * monobank acquiring ("Plata by mono") client.
 *
 * Docs: https://monobank.ua/api-docs/acquiring
 *
 * Three ways to take money, tried in this order (BILLING.md → "How it works"):
 *   1. createSubscription() — monobank's own subscription ("Регулярні
 *      платежі"). The bank charges the card every period by itself and knocks
 *      on our chargeUrl / statusUrl; we then ask it what happened.
 *   2. createInvoice() with saveCardData — a one-off invoice, when the bank
 *      refuses a subscription to this merchant. monobank POSTs to webHookUrl on
 *      status change (signed with X-Sign) and may tokenize the card.
 *   3. chargeWallet() — the daily cron charges a card saved by road 2.
 *
 * Two tokens. MONOBANK_TOKEN runs invoices, saved cards and the webhook key.
 * MONOBANK_SUB_TOKEN runs subscriptions, when the bank issued a separate
 * terminal for them; without it MONOBANK_TOKEN is used for those too.
 * Subscriptions and tokenization are off for a new merchant until monobank's
 * support turns them on.
 *
 * All amounts are in minor units (kopiykas). All money is UAH (ccy 980) because
 * monobank acquiring does not support charging foreign currencies directly.
 */

const API_BASE = (process.env.MONOBANK_API_BASE ?? "https://api.monobank.ua").replace(/\/$/, "");
const TOKEN = process.env.MONOBANK_TOKEN ?? "";
const SUB_TOKEN = process.env.MONOBANK_SUB_TOKEN || TOKEN;

export const isMonobankConfigured = !!TOKEN;

export class MonobankError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** monobank's `errCode`, e.g. "1001" or "BAD_REQUEST". */
    readonly code?: string,
  ) {
    super(message);
    this.name = "MonobankError";
  }
}

async function call<T>(path: string, init: RequestInit, token: string = TOKEN): Promise<T> {
  if (!token) {
    throw new MonobankError("MONOBANK_TOKEN is not configured.");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Token": token,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const err = body && typeof body === "object" ? (body as { errText?: unknown; errCode?: unknown }) : {};
    const msg = err.errText != null ? String(err.errText) : `monobank ${path} failed (${res.status})`;
    throw new MonobankError(msg, res.status, err.errCode != null ? String(err.errCode) : undefined);
  }
  return body as T;
}

// ── Invoice creation ──────────────────────────────────────────────────────────

export interface CreateInvoiceParams {
  /** Amount in kopiykas. */
  amount: number;
  /** ISO 4217 numeric currency code. Defaults to UAH (980). */
  ccy?: number;
  /** Our order reference — we encode "<userId>|<plan>" so the webhook is self-describing. */
  reference: string;
  /** Short human description shown on the payment page. */
  destination: string;
  /** Where monobank returns the customer after payment (GET). */
  redirectUrl: string;
  /** Where monobank POSTs status updates. */
  webHookUrl: string;
  /** Pass to tokenize the customer's card for later recurring charges. */
  walletId?: string;
  /** Seconds the invoice stays payable. Defaults to monobank's 24h. */
  validitySeconds?: number;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  pageUrl: string;
}

export async function createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  const body: Record<string, unknown> = {
    amount: params.amount,
    ccy: params.ccy ?? 980,
    merchantPaymInfo: {
      reference: params.reference,
      destination: params.destination,
    },
    redirectUrl: params.redirectUrl,
    webHookUrl: params.webHookUrl,
  };
  if (params.validitySeconds) body.validity = params.validitySeconds;
  if (params.walletId) {
    // Tokenize the card so we can charge it again for auto-renewal.
    body.saveCardData = { saveCard: true, walletId: params.walletId };
  }

  return call<CreateInvoiceResult>("/api/merchant/invoice/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Invoice status ──────────────────────────────────────────────────────────

export type InvoiceStatus =
  | "created"
  | "processing"
  | "hold"
  | "success"
  | "failure"
  | "reversed"
  | "expired";

export interface InvoiceStatusResult {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  finalAmount?: number;
  reference?: string;
  failureReason?: string;
  modifiedDate?: string;
}

export async function getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult> {
  return call<InvoiceStatusResult>(
    `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
    { method: "GET" }
  );
}

// ── Saved cards / recurring charges ───────────────────────────────────────────

export interface WalletCard {
  cardToken: string;
  maskedPan: string;
  expDate: string;
  country?: string;
}

export async function listWalletCards(walletId: string): Promise<WalletCard[]> {
  const res = await call<{ wallet?: WalletCard[] }>(
    `/api/merchant/wallet?walletId=${encodeURIComponent(walletId)}`,
    { method: "GET" }
  );
  return res.wallet ?? [];
}

export interface ChargeWalletParams {
  cardToken: string;
  amount: number;
  ccy?: number;
  reference: string;
  destination: string;
  webHookUrl: string;
  /** "merchant" for unattended recurring charges, "client" when the user is present. */
  initiationKind?: "merchant" | "client";
}

export interface ChargeWalletResult {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  tdsUrl?: string;
  failureReason?: string;
}

/** Charge a previously tokenized card. Used for monthly auto-renewal. */
export async function chargeWallet(params: ChargeWalletParams): Promise<ChargeWalletResult> {
  return call<ChargeWalletResult>("/api/merchant/wallet/payment", {
    method: "POST",
    body: JSON.stringify({
      cardToken: params.cardToken,
      amount: params.amount,
      ccy: params.ccy ?? 980,
      initiationKind: params.initiationKind ?? "merchant",
      webHookUrl: params.webHookUrl,
      merchantPaymInfo: {
        reference: params.reference,
        destination: params.destination,
      },
    }),
  });
}

// ── Bank-side subscriptions ("Регулярні платежі") ──────────────────────────────

export interface CreateSubscriptionParams {
  /** Amount per period, in kopiykas. */
  amount: number;
  ccy?: number;
  /** "{number}{unit}": "1d", "2w", "1m", "1y". */
  interval: string;
  /** Where monobank returns the customer after paying (GET). */
  redirectUrl: string;
  /** monobank POSTs here after every charge. The body is not documented. */
  chargeUrl: string;
  /** monobank POSTs here when the subscription's state changes. */
  statusUrl: string;
  /** Seconds the payment page stays open. Defaults to monobank's 24h. */
  validitySeconds?: number;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  pageUrl: string;
}

/**
 * Create a subscription the bank charges by itself every `interval`. There is
 * no `reference` field: the caller tells its subscribers apart by a secret in
 * chargeUrl / statusUrl.
 */
export async function createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
  const body: Record<string, unknown> = {
    amount: params.amount,
    ccy: params.ccy ?? 980,
    interval: params.interval,
    redirectUrl: params.redirectUrl,
    webHookUrls: { chargeUrl: params.chargeUrl, statusUrl: params.statusUrl },
  };
  if (params.validitySeconds) body.validity = params.validitySeconds;
  return call<CreateSubscriptionResult>(
    "/api/merchant/subscription/create",
    { method: "POST", body: JSON.stringify(body) },
    SUB_TOKEN,
  );
}

/**
 * The bank would not open a subscription to this merchant: subscriptions (or
 * host-to-host payments) are not switched on for it. The caller falls back to
 * a one-off invoice. Any other failure is a real error, not a refusal.
 */
export function isSubscriptionRefused(err: unknown): boolean {
  if (!(err instanceof MonobankError)) return false;
  return err.code === "1001" || /h2h/i.test(err.message);
}

export interface SubscriptionStatusResult {
  subscriptionId: string;
  /** monobank documents two states. A subscription it cancelled after a failed charge reads "cancelled" too. */
  status: "active" | "cancelled" | string;
  amount: number;
  ccy: number;
  interval: string;
  startDate?: string;
  endDate?: string;
  nextChargeDate?: string;
  /** Why it was cancelled, when it was. */
  cancellationDesc?: string;
}

export async function getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatusResult> {
  return call<SubscriptionStatusResult>(
    `/api/merchant/subscription/status?subscriptionId=${encodeURIComponent(subscriptionId)}`,
    { method: "GET" },
    SUB_TOKEN,
  );
}

export interface SubscriptionPayment {
  amount: number;
  ccy: number;
  /** "success" is the only state documented with an example. */
  status: string;
  /** When the bank charged. A charge has no id of its own — this is its identity. */
  chargedAt: string;
}

/** Every charge of a subscription since `dateFrom`, all pages. */
export async function listSubscriptionPayments(subscriptionId: string, dateFrom: Date): Promise<SubscriptionPayment[]> {
  const out: SubscriptionPayment[] = [];
  const PAGE_SIZE = 100;
  // A monthly subscription has a handful of charges; the cap only stops a
  // misbehaving pagination from looping.
  for (let page = 1; page <= 20; page++) {
    const qs = new URLSearchParams({
      subscriptionId,
      dateFrom: dateFrom.toISOString(),
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    const res = await call<{ payments?: SubscriptionPayment[]; pagination?: { totalPages?: number } }>(
      `/api/merchant/subscription/payments?${qs}`,
      { method: "GET" },
      SUB_TOKEN,
    );
    out.push(...(res.payments ?? []));
    const totalPages = res.pagination?.totalPages ?? 1;
    if (page >= totalPages || (res.payments ?? []).length === 0) break;
  }
  return out;
}

/**
 * Stop future charges. Deliberately never sends `refundAmount`: with it, the
 * same call also refunds money, and cancelling must not do that.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await call<unknown>(
    "/api/merchant/subscription/edit",
    { method: "POST", body: JSON.stringify({ subscriptionId, action: "cancel" }) },
    SUB_TOKEN,
  );
}

/** Invalidate a subscription — for one the customer never paid, or one we failed to record. */
export async function removeSubscription(subscriptionId: string): Promise<void> {
  await call<unknown>(
    "/api/merchant/subscription/remove",
    { method: "POST", body: JSON.stringify({ subscriptionId }) },
    SUB_TOKEN,
  );
}

// ── Health probe ─────────────────────────────────────────────────────────────

/**
 * Whether monobank accepts the token, and how fast it answers: the cheapest
 * authenticated request there is, the merchant's public key (GS1-1, the
 * dashboard's service row). A present token is not a working one — a revoked
 * key still reads as "configured". With a separate subscription token, both
 * are asked: either one revoked stops payments.
 */
export async function pingMonobank(
  timeoutMs: number,
): Promise<{ ok: true; ms: number } | { ok: false; status?: number; message: string }> {
  if (!TOKEN) return { ok: false, message: "MONOBANK_TOKEN is not configured." };
  const started = Date.now();
  const tokens = SUB_TOKEN === TOKEN ? [["MONOBANK_TOKEN", TOKEN]] : [["MONOBANK_TOKEN", TOKEN], ["MONOBANK_SUB_TOKEN", SUB_TOKEN]];
  try {
    for (const [name, token] of tokens) {
      const res = await fetch(`${API_BASE}/api/merchant/pubkey`, {
        headers: { "X-Token": token },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return { ok: false, status: res.status, message: `monobank answered ${res.status} to ${name}` };
    }
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "monobank did not answer" };
  }
}

// ── Webhook signature verification ────────────────────────────────────────────

let cachedPubKeyPem: string | null = null;

async function fetchPublicKeyPem(): Promise<string> {
  const res = await call<{ key: string }>("/api/merchant/pubkey", { method: "GET" });
  // The `key` field is base64; decoding it yields the PEM-formatted public key.
  return Buffer.from(res.key, "base64").toString("utf-8");
}

/**
 * Verify a monobank webhook.
 *
 * monobank signs the raw request body with ECDSA (SHA256) using its merchant
 * key. The signature arrives base64-encoded in the `X-Sign` header. We verify
 * against the public key from /api/merchant/pubkey, refetching once if a stale
 * cached key fails (monobank rotates keys rarely).
 */
export async function verifyWebhookSignature(rawBody: string, xSign: string | null): Promise<boolean> {
  if (!xSign) return false;
  const signature = Buffer.from(xSign, "base64");

  const tryVerify = (pem: string): boolean => {
    try {
      const verifier = crypto.createVerify("SHA256");
      verifier.update(rawBody);
      verifier.end();
      return verifier.verify(pem, signature);
    } catch {
      return false;
    }
  };

  if (!cachedPubKeyPem) {
    cachedPubKeyPem = await fetchPublicKeyPem();
  }
  if (tryVerify(cachedPubKeyPem)) return true;

  // Cached key may be stale — refetch once and retry.
  cachedPubKeyPem = await fetchPublicKeyPem();
  return tryVerify(cachedPubKeyPem);
}

/** Shape of the webhook POST body monobank sends on invoice status change. */
export interface WebhookPayload {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  finalAmount?: number;
  reference?: string;
  failureReason?: string;
  modifiedDate?: string;
}
