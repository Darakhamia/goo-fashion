"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";
import type { PlanId } from "@/lib/plans";
import { PLANS, planPriceLabel, planPriceUsdLabel } from "@/lib/plans";

export interface UpgradePrompt {
  /** Human-readable message from the server (402 body). */
  message: string;
  /** Feature key the user tried to use. */
  feature?: string;
  /** Cheapest plan that unlocks it, or null. */
  requiredPlan?: PlanId | null;
  /** Server-provided upgrade URL, e.g. "/plans?highlight=basic". */
  upgradeUrl?: string;
}

interface Props {
  prompt: UpgradePrompt | null;
  onClose: () => void;
}

export function UpgradeModal({ prompt, onClose }: Props) {
  const router = useRouter();

  /**
   * Модалка должна пережить собственное закрытие: пока играет выход, `prompt`
   * уже `null`, но панель ещё на экране и ей есть что рисовать. Поэтому здесь
   * держится снимок последнего показа. Раньше стоял голый
   * `if (!prompt) return null`, и панель, открывшись без всякой анимации,
   * исчезала в один кадр.
   *
   * Снимок обновляется прямо в рендере (документированный способ вывести
   * состояние из пропсов), а не в эффекте: эффект тут дал бы лишний каскадный
   * рендер на каждое открытие.
   */
  const [shown, setShown] = useState<UpgradePrompt | null>(prompt);
  if (prompt && prompt !== shown) setShown(prompt);

  const ov = useOverlayPresence(prompt !== null);

  // Esc закрывает — до этого выйти можно было только кликом по фону.
  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, onClose]);

  if (!shown) return null;

  const planName =
    shown.requiredPlan && PLANS[shown.requiredPlan]
      ? PLANS[shown.requiredPlan].name
      : null;
  const usdLabel =
    shown.requiredPlan && PLANS[shown.requiredPlan]
      ? planPriceUsdLabel(shown.requiredPlan)
      : null;
  const uahLabel =
    shown.requiredPlan && PLANS[shown.requiredPlan]
      ? planPriceLabel(shown.requiredPlan)
      : null;

  const handleUpgrade = () => {
    const url =
      shown.upgradeUrl ||
      (shown.requiredPlan ? `/plans?highlight=${shown.requiredPlan}` : "/plans");
    router.push(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade required"
      // Phones: a sheet from the bottom (DESIGN_SYSTEM.md §12.7, mockup v2 «Б · Окно „нужен тариф“»).
      className={ov.cls(
        "ov-scrim fixed inset-0 z-[80] flex items-end md:items-center justify-center md:px-4 bg-black/60 backdrop-blur-sm"
      )}
      onClick={onClose}
      onTransitionEnd={(e) => {
        // Узел уходит из DOM только когда выход действительно доигран.
        if (e.target === e.currentTarget && ov.closing) setShown(null);
      }}
    >
      <div
        className="ov-panel relative md:border md:border-[var(--border)] rounded-t-3xl md:rounded-2xl w-full md:max-w-md bg-[var(--surface)] md:bg-[var(--background)] shadow-2xl max-md:text-center max-md:px-5 max-md:pt-2 max-md:pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="md:hidden mx-auto w-9 h-1 rounded-full bg-[var(--border-strong)]" />
        {/* Крестик: раньше закрыть можно было только кликом по фону, то есть
            наугад. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 w-11 h-11 md:top-3 md:right-3 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true" className="max-md:w-4 max-md:h-4">
            <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className="pt-10 md:px-6 md:pt-6 md:pb-4">
          {/* Phones: a lock in a soft circle instead of the caps eyebrow. */}
          <span aria-hidden="true" className="md:hidden mx-auto w-[60px] h-[60px] rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[var(--foreground)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <p className="hidden md:block font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-3">
            Upgrade required
          </p>
          <h2 className="mt-4 text-[20px] font-semibold mb-2 md:mt-0 md:text-2xl md:font-bold md:mb-3 text-[var(--foreground)] leading-tight">
            {planName
              ? `This feature is on ${planName}`
              : "Upgrade to continue"}
          </h2>
          <p className="max-md:mx-auto max-md:max-w-[300px] text-[15px] leading-normal md:text-sm md:leading-relaxed text-[var(--foreground-muted)]">
            {shown.message}
          </p>
        </div>

        {planName && usdLabel !== null && (
          <div className="hidden md:block px-6 pb-4">
            <div className="border border-[var(--border)] px-4 py-3 flex items-baseline justify-between">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                {planName}
              </span>
              <span className="text-xl font-semibold text-[var(--foreground)]">
                {usdLabel}
                {uahLabel && <span className="text-xs text-[var(--foreground-muted)] ml-1.5">({uahLabel})</span>}
                <span className="text-xs text-[var(--foreground-muted)] ml-1">/mo</span>
              </span>
            </div>
          </div>
        )}

        <div className="mt-[22px] flex flex-col gap-1.5 md:mt-0 md:flex-row md:gap-3 md:px-6 md:pb-6">
          <button
            onClick={handleUpgrade}
            className="h-[50px] rounded-full text-[16px] font-semibold md:h-auto md:flex-1 md:rounded-none md:font-mono md:text-[10px] md:tracking-[0.14em] md:uppercase md:font-normal md:py-3.5 bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
          >
            {planName ? `Upgrade to ${planName}` : "See plans"}
          </button>
          <button
            onClick={onClose}
            className="h-11 text-[15px] text-[var(--foreground-muted)] md:h-auto md:border md:border-[var(--border)] md:px-5 md:py-3.5 md:font-mono md:text-[10px] md:tracking-[0.12em] md:uppercase md:text-[var(--foreground)] md:hover:bg-[var(--surface)] transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Parse a fetch Response for a 402 Payment Required payload from requirePlan().
 * Returns an UpgradePrompt if the response looks like an upgrade nudge,
 * null otherwise. Does NOT consume the body of non-402 responses.
 */
export async function parseUpgradePrompt(res: Response): Promise<UpgradePrompt | null> {
  if (res.status !== 402) return null;
  try {
    const json = await res.clone().json();
    return {
      message: typeof json.error === "string" ? json.error : "Upgrade to continue.",
      feature: typeof json.feature === "string" ? json.feature : undefined,
      requiredPlan:
        json.requiredPlan === "basic" ||
        json.requiredPlan === "pro" ||
        json.requiredPlan === "premium"
          ? (json.requiredPlan as PlanId)
          : null,
      upgradeUrl: typeof json.upgradeUrl === "string" ? json.upgradeUrl : undefined,
    };
  } catch {
    return { message: "Upgrade to continue." };
  }
}
