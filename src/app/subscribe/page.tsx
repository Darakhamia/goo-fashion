"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { PAID_PLAN_IDS, PLANS, planPriceLabel, type PlanId } from "@/lib/plans";
import { defineDict } from "@/lib/i18n/locale";
import { useDict } from "@/lib/context/locale-context";
import { StylistPersonalizationModal, type StylistPersonalization } from "@/components/stylist/StylistPersonalizationModal";

// ── Copy (EN default, UA by the visitor's choice) ────────────────────────────
// Marketing copy, kept separate from the feature gate map.

type PaidPlan = "basic" | "pro" | "premium";
/** A plan's price: the dollar headline figure and the hryvnia amount actually charged. */
type Price = { usd: number; uah: string };

const DICT = defineDict({
  en: {
    features: {
      basic: ["50 image generations / mo", "~300 AI messages / mo", "Outfit builder", "Basic AI stylist", "Standard speed"],
      pro: ["180 image generations / mo", "~1,000 AI messages / mo", "Priority generation", "Better AI stylist", "Save outfits", "Higher image quality"],
      premium: ["450 image generations / mo", "~3,000 AI messages / mo", "Very fast generation", "Near-unlimited AI usage", "Stylist memory", "Exclusive styles"],
    } as Record<PaidPlan, string[]>,
    checkoutFailed: "Could not start checkout. Try again.",
    networkError: "Network error. Try again.",
    confirmingTitle: "Confirming your payment",
    confirmingText: "We’re waiting for monobank to confirm the transaction. This usually takes a few seconds — please don’t close this page.",
    stillTitle: "Still processing",
    stillText: "Your payment is taking a little longer to confirm. If it went through, your plan will unlock automatically — check your profile in a minute.",
    goToProfile: "Go to profile",
    youAreIn: "You are in",
    welcome: (name: string) => `Welcome to ${name}`,
    successText: "Your payment went through and your account is upgraded. AI Stylist and image generation are unlocked. Your plan renews automatically each month.",
    openBuilder: "Open builder",
    onPlan: (name: string) => `You are on ${name}`,
    onPlanShort: (name: string) => `You’re on ${name}`,
    redirecting: "Redirecting to payment...",
    redirectingShort: "Redirecting…",
    signInToContinue: "Sign in to continue",
    pay: (p: Price) => `Pay $${p.usd} (${p.uah}) — continue`,
    continueToPayment: "Continue to payment",
    backToPlans: "Back to plans",
    subscribe: "Subscribe",
    planTitle: (name: string) => `${name} plan`,
    // Phone plaque: headline price, its unit, the line under it.
    phonePrice: (p: Price) => `$${p.usd}`,
    phoneUnit: " / month",
    chargedVia: (p: Price) => `charged as ${p.uah} / month via monobank`,
    subscribingTo: "You are subscribing to",
    summaryPrice: (p: Price) => `$${p.usd} / month`,
    included: "What’s included",
    notice: "Secure payment via monobank (Plata by mono). You’ll be redirected to monobank’s payment page. Your subscription renews automatically each month — cancel anytime from your profile.",
    barPrice: (uah: string) => `${uah} / month`,
    barSub: (usd: number) => `≈ $${usd} · cancel anytime`,
  },
  uk: {
    features: {
      basic: ["50 генерацій зображень / міс", "~300 повідомлень AI / міс", "Конструктор образів", "Базовий AI-стиліст", "Стандартна швидкість"],
      pro: ["180 генерацій зображень / міс", "~1 000 повідомлень AI / міс", "Пріоритетна генерація", "Кращий AI-стиліст", "Збереження образів", "Вища якість зображень"],
      premium: ["450 генерацій зображень / міс", "~3 000 повідомлень AI / міс", "Дуже швидка генерація", "Майже безлімітний AI", "Пам’ять стиліста", "Ексклюзивні стилі"],
    } as Record<PaidPlan, string[]>,
    checkoutFailed: "Не вдалося перейти до оплати. Спробуйте ще раз.",
    networkError: "Помилка мережі. Спробуйте ще раз.",
    confirmingTitle: "Підтверджуємо оплату",
    confirmingText: "Чекаємо, поки monobank підтвердить платіж. Зазвичай це займає кілька секунд — будь ласка, не закривайте сторінку.",
    stillTitle: "Ще обробляється",
    stillText: "Підтвердження платежу триває трохи довше. Якщо оплата пройшла, тариф увімкнеться автоматично — перевірте профіль за хвилину.",
    goToProfile: "Перейти в профіль",
    youAreIn: "Готово",
    welcome: (name: string) => `Вітаємо в ${name}`,
    successText: "Оплата пройшла, акаунт оновлено. AI-стиліст і генерація зображень доступні. Тариф продовжується автоматично щомісяця.",
    openBuilder: "Відкрити конструктор",
    onPlan: (name: string) => `У вас тариф ${name}`,
    onPlanShort: (name: string) => `У вас ${name}`,
    redirecting: "Переходимо до оплати...",
    redirectingShort: "Переходимо…",
    signInToContinue: "Увійдіть, щоб продовжити",
    pay: (p: Price) => `Сплатити ${p.uah} — продовжити`,
    continueToPayment: "Перейти до оплати",
    backToPlans: "Назад до тарифів",
    subscribe: "Підписка",
    planTitle: (name: string) => `Тариф ${name}`,
    // Charged in hryvnia, so hryvnia leads.
    phonePrice: (p: Price) => p.uah,
    phoneUnit: " / міс",
    chargedVia: (p: Price) => `≈ $${p.usd} · оплата через monobank`,
    subscribingTo: "Ви оформлюєте підписку",
    summaryPrice: (p: Price) => `${p.uah} / міс`,
    included: "Що входить",
    notice: "Безпечна оплата через monobank (Plata by mono). Ви перейдете на сторінку оплати monobank. Підписка продовжується автоматично щомісяця — скасувати можна будь-коли в профілі.",
    barPrice: (uah: string) => `${uah} / міс`,
    barSub: (usd: number) => `≈ $${usd} · скасування будь-коли`,
  },
});

// ── Check icon ────────────────────────────────────────────────────────────────

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--foreground)] shrink-0 mt-0.5">
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Inner page (reads search params) ─────────────────────────────────────────

function SubscribeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const [showPersonalization, setShowPersonalization] = useState(false);

  const rawPlanId = searchParams.get("plan");
  const planId: Exclude<PlanId, "free"> = PAID_PLAN_IDS.includes(rawPlanId as PlanId)
    ? (rawPlanId as Exclude<PlanId, "free">)
    : "basic";
  const plan = PLANS[planId];
  const t = useDict(DICT);
  const features = t.features[planId];
  const priceLabel = planPriceLabel(planId);
  const price = { usd: plan.price, uah: priceLabel };

  const currentPlan = (user?.publicMetadata as { plan?: string })?.plan ?? "free";
  const alreadyOnPlan = currentPlan === planId;

  // "return" = monobank redirected back here after the customer paid.
  const isReturn = searchParams.get("status") === "return";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // While waiting for the webhook to flip the plan after a return from monobank.
  const [verifying, setVerifying] = useState(false);
  const [verifyTimedOut, setVerifyTimedOut] = useState(false);
  const pollStarted = useRef(false);

  // ── Kick off checkout: create a monobank invoice and redirect to its page ──
  const handleSubscribe = async () => {
    if (!isSignedIn) {
      router.push(`/login?redirect_url=${encodeURIComponent(`/subscribe?plan=${planId}`)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.pageUrl) {
        setError(body.error ?? t.checkoutFailed);
        setSubmitting(false);
        return;
      }
      // Hand off to monobank's hosted payment page.
      window.location.assign(body.pageUrl);
    } catch {
      setError(t.networkError);
      setSubmitting(false);
    }
  };

  // ── On return from monobank: poll Clerk until the webhook unlocks the plan ──
  // The flow is declared inside the effect so the linter can see that every
  // setState in it runs after an await, never on the synchronous effect path.
  useEffect(() => {
    if (!isReturn || !isLoaded || !user || pollStarted.current) return;
    pollStarted.current = true;
    const unlocked = () => (user.publicMetadata as { plan?: string })?.plan === planId;
    // Ask the server to check with monobank now: its notification can be late
    // or lost. The server limits how often it really asks the bank.
    const syncWithBank = () => fetch("/api/billing/sync", { method: "POST" }).catch(() => null);
    const runReturnFlow = async () => {
      await syncWithBank();
      // Refresh once up front; this keeps every setState below off the synchronous
      // effect path and reflects a webhook that may have already landed.
      await user.reload();
      if (unlocked()) {
        setSuccess(true);
        setShowPersonalization(true);
        return;
      }
      setVerifying(true);
      const deadline = Date.now() + 45_000; // ~45s
      for (let tick = 1; Date.now() < deadline; tick++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (tick % 6 === 0) await syncWithBank();
        await user.reload();
        if (unlocked()) {
          setVerifying(false);
          setSuccess(true);
          setShowPersonalization(true);
          return;
        }
      }
      setVerifying(false);
      setVerifyTimedOut(true);
    };
    void runReturnFlow();
  }, [isReturn, isLoaded, user, planId]);

  // ── Verifying state (waiting for monobank webhook) ─────────────────────────
  if (verifying) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[520px] mx-auto px-6 md:px-8 py-24 text-center">
          <div className="w-10 h-10 mx-auto mb-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
          <h1 className="text-[22px] font-semibold md:text-2xl md:font-black md:uppercase text-[var(--foreground)] mb-3">
            {t.confirmingTitle}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto leading-relaxed">
            {t.confirmingText}
          </p>
        </div>
      </div>
    );
  }

  // ── Timed out waiting for confirmation ─────────────────────────────────────
  if (verifyTimedOut) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[520px] mx-auto px-6 md:px-8 py-24 text-center">
          <h1 className="text-[22px] font-semibold md:text-2xl md:font-black md:uppercase text-[var(--foreground)] mb-3">
            {t.stillTitle}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto leading-relaxed mb-8">
            {t.stillText}
          </p>
          <button
            onClick={() => router.push("/profile")}
            className="h-12 rounded-full bg-[var(--fg-overlay-08)] text-[15px] font-medium md:h-auto md:rounded-xl md:bg-transparent md:border md:border-[var(--border-strong)] md:font-mono md:text-[10px] md:tracking-[0.12em] md:uppercase md:font-normal md:py-4 md:hover:bg-[var(--surface)] text-[var(--foreground)] px-6 transition-colors"
          >
            {t.goToProfile}
          </button>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    const handleSavePersonalization = async (data: StylistPersonalization) => {
      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          stylistPersonalization: data,
        },
      });
      setShowPersonalization(false);
    };

    return (
      <div className="min-h-screen">
        <div className="max-w-[520px] mx-auto px-6 md:px-8 py-16 md:py-24 text-center">
          <div className="w-14 h-14 mx-auto mb-8 border border-[var(--foreground)] rounded-full flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L10 17.5L19 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[13px] text-[var(--foreground-muted)] md:font-mono md:text-[10px] md:tracking-[0.22em] md:uppercase md:text-[var(--foreground-subtle)] mb-1.5 md:mb-3">
            {t.youAreIn}
          </p>
          {/* Desktop keeps the -0.015em the size rule gave text-4xl (§12.13). */}
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.15] md:text-5xl md:font-black md:uppercase md:tracking-[-0.015em] md:leading-[1.05] text-[var(--foreground)] mb-3 md:mb-5">
            {t.welcome(plan.name)}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] max-w-sm mx-auto leading-relaxed mb-10">
            {t.successText}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push("/builder")}
              className="h-12 rounded-full text-[15px] font-semibold md:h-auto md:rounded-xl md:font-mono md:text-[10px] md:tracking-[0.14em] md:uppercase md:font-normal md:py-4 bg-[var(--foreground)] text-[var(--background)] px-6 hover:opacity-80 transition-opacity"
            >
              {t.openBuilder}
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="h-12 rounded-full bg-[var(--fg-overlay-08)] text-[15px] font-medium md:h-auto md:rounded-xl md:bg-transparent md:border md:border-[var(--border-strong)] md:font-mono md:text-[10px] md:tracking-[0.12em] md:uppercase md:font-normal md:py-4 md:hover:bg-[var(--surface)] text-[var(--foreground)] px-6 transition-colors"
            >
              {t.goToProfile}
            </button>
          </div>
        </div>

        {showPersonalization && (
          <StylistPersonalizationModal
            initial={null}
            userName={user?.firstName ?? ""}
            onClose={() => setShowPersonalization(false)}
            onSave={handleSavePersonalization}
          />
        )}
      </div>
    );
  }

  const ctaLabel = alreadyOnPlan
    ? t.onPlan(plan.name)
    : submitting
    ? t.redirecting
    : !isSignedIn
    ? t.signInToContinue
    : t.pay(price);

  // ── Main state ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <div className="max-w-[520px] mx-auto px-3 pt-5 pb-8 md:px-8 md:py-24">

        {/* Back link — desktop only: on a phone the header carries "back" (R-03) */}
        <button
          onClick={() => router.push("/plans")}
          className="hidden md:flex items-center gap-2 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors mb-12 group"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.backToPlans}
        </button>

        {/* Header */}
        <div className="px-1 mb-4 md:px-0 md:mb-10">
          <p className="text-[13px] text-[var(--foreground-muted)] md:font-mono md:text-[10px] md:tracking-[0.22em] md:uppercase md:text-[var(--foreground-subtle)] mb-1 md:mb-3">
            {t.subscribe}
          </p>
          {/* Desktop keeps the -0.015em the size rule gave text-4xl (§12.13). */}
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.15] md:text-5xl md:font-black md:uppercase md:tracking-[-0.015em] md:leading-[1.05] text-[var(--foreground)]">
            {t.planTitle(plan.name)}
          </h1>
        </div>

        {/* Phones: the plan, its price and what it includes on one plaque
            (mockup v2 «Б · Оформление подписки»). */}
        <div className="md:hidden rounded-[20px] bg-[var(--surface)] p-[18px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-semibold text-[var(--foreground)]">{plan.name}</span>
            <span>
              <span className="text-[24px] font-bold text-[var(--foreground)]">{t.phonePrice(price)}</span>
              <span className="text-[14px] text-[var(--foreground-muted)]">{t.phoneUnit}</span>
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--foreground-muted)]">{t.chargedVia(price)}</p>
          <ul className="mt-4 pt-3.5 shadow-[inset_0_1px_0_var(--border)] flex flex-col gap-[9px]">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[14px] text-[var(--foreground)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M5 12l5 5 9-10" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Summary block */}
        <div className="hidden md:block border border-[var(--border)] rounded-2xl p-6 mb-8">
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-1">
            {t.subscribingTo}
          </p>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {plan.name} — <span className="text-[var(--foreground)]">{t.summaryPrice(price)}</span>
          </p>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {t.chargedVia(price)}
          </p>
        </div>

        {/* Features */}
        <div className="hidden md:block mb-10">
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-5">
            {t.included}
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check />
                <span className="text-sm text-[var(--foreground-muted)] leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error toast */}
        {error && (
          <p className="mt-3 md:mt-0 mb-0 md:mb-4 text-[13px] md:text-xs text-red-500 border border-red-300 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleSubscribe}
          disabled={submitting || !isLoaded || alreadyOnPlan}
          className="hidden md:inline-block w-full font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-4 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ctaLabel}
        </button>

        {/* Payment notice */}
        <p className="px-1 md:px-0 mt-3.5 md:mt-4 text-left md:text-center text-[13px] md:text-xs text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] leading-normal md:leading-relaxed">
          {t.notice}
        </p>

      </div>

      {/* Phones: the buy bar stands where the tab bar would (CEO decision 4a,
          DESIGN_SYSTEM.md §12.8); `hasBuyBar("/subscribe")` hides the tab bar. */}
      <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 h-16 rounded-3xl border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md flex items-center gap-2 pl-[18px] pr-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[var(--foreground)] truncate">{t.barPrice(priceLabel)}</p>
          <p className="text-[12px] text-[var(--foreground-muted)] truncate">{t.barSub(plan.price)}</p>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={submitting || !isLoaded || alreadyOnPlan}
          className="shrink-0 h-11 px-5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[15px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {alreadyOnPlan
            ? t.onPlanShort(plan.name)
            : submitting
            ? t.redirectingShort
            : !isSignedIn
            ? t.signInToContinue
            : t.continueToPayment}
        </button>
      </div>
    </div>
  );
}

// ── Page (wrapped in Suspense for useSearchParams) ────────────────────────────

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeInner />
    </Suspense>
  );
}
