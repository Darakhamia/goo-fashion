"use client";

import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

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
  if (!prompt) return null;

  const planName =
    prompt.requiredPlan && PLANS[prompt.requiredPlan]
      ? PLANS[prompt.requiredPlan].name
      : null;
  const price =
    prompt.requiredPlan && PLANS[prompt.requiredPlan]
      ? PLANS[prompt.requiredPlan].price
      : null;

  const handleUpgrade = () => {
    const url =
      prompt.upgradeUrl ||
      (prompt.requiredPlan ? `/plans?highlight=${prompt.requiredPlan}` : "/plans");
    router.push(url);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="border border-[var(--border)] w-full max-w-md bg-[var(--background)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-3">
            Upgrade required
          </p>
          <h2 className="font-display text-2xl font-light text-[var(--foreground)] leading-tight mb-3">
            {planName
              ? `This feature is on ${planName}`
              : "Upgrade to continue"}
          </h2>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            {prompt.message}
          </p>
        </div>

        {planName && price !== null && (
          <div className="px-6 pb-4">
            <div className="border border-[var(--border)] px-4 py-3 flex items-baseline justify-between">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                {planName}
              </span>
              <span className="font-display text-xl font-light text-[var(--foreground)]">
                ${price}
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
