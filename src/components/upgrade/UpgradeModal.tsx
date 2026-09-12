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
      className={ov.cls(
        "ov-scrim fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      )}
      onClick={onClose}
      onTransitionEnd={(e) => {
        // Узел уходит из DOM только когда выход действительно доигран.
        if (e.target === e.currentTarget && ov.closing) setShown(null);
      }}
    >
      <div
        className="ov-panel relative border border-[var(--border)] rounded-2xl w-full max-w-md bg-[var(--background)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Крестик: раньше закрыть можно было только кликом по фону, то есть
            наугад. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className="px-6 pt-6 pb-4">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-3">
            Upgrade required
          </p>
          <h2 className="text-2xl font-bold text-[var(--foreground)] leading-tight mb-3">
            {planName
              ? `This feature is on ${planName}`
              : "Upgrade to continue"}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            {shown.message}
          </p>
        </div>

        {planName && usdLabel !== null && (
          <div className="px-6 pb-4">
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

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleUpgrade}
            className="flex-1 bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] tracking-[0.14em] uppercase py-3.5 hover:opacity-80 transition-opacity"
          >
            {planName ? `Upgrade to ${planName}` : "See plans"}
          </button>
          <button
            onClick={onClose}
            className="border border-[var(--border)] px-5 py-3.5 font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
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
