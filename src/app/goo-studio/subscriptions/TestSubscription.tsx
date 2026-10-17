"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormat, useT, type Key } from "@/app/goo-studio/_i18n";
import { FormPanel, FormSection } from "@/components/admin/FormSection";
import { BANNER, BTN_DANGER, BTN_PRIMARY, FIELD_LABEL, SELECT } from "@/app/goo-studio/_ui/recipes";

/*
 * Test subscription (BILLING.md, "Test subscription"): the super admin
 * subscribes their own account for 10 UAH a day to watch real charges and
 * renewals. GET/POST /api/admin/billing-test; stopping is the customer's own
 * cancel, POST /api/billing/cancel. Anyone else gets a 401 and sees nothing.
 */

interface OwnSubscription {
  plan: string;
  status: string;
  interval: "1m" | "1d";
  amountMinor: number;
  autoRenew: boolean;
  currentPeriodEnd: string | null;
  maskedPan: string | null;
  hasCardToken: boolean;
  bankSubscription: boolean;
}
interface State {
  configured: boolean;
  amountMinor: number;
  subscription: OwnSubscription | null;
  realPlanRunning: boolean;
}

const PLANS: { id: string; label: Key }[] = [
  { id: "basic", label: "plan.basic" },
  { id: "pro", label: "plan.pro" },
  { id: "premium", label: "plan.premium" },
];

function planKey(plan: string): Key {
  return PLANS.find((p) => p.id === plan)?.label ?? "plan.basic";
}

export function TestSubscription() {
  const t = useT();
  const f = useFormat();
  const [state, setState] = useState<State | null>(null);
  const [plan, setPlan] = useState("pro");
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
  const [stopped, setStopped] = useState(false);
  // The server's message, shown as it came; "" while there is none.
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/billing-test");
      if (!res.ok) return; // not the super admin, or the read failed: no block
      setState((await res.json()) as State);
    } catch {
      // A network failure leaves the block out, like the 401.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;

  const amount = f.money(state.amountMinor / 100, "UAH");
  const sub = state.subscription;
  const testSub = sub && sub.interval === "1d" && sub.autoRenew ? sub : null;
  const running = testSub?.status === "active" || testSub?.status === "past_due";
  const pending = testSub?.status === "pending";

  const start = async () => {
    setBusy("start");
    setError("");
    try {
      const res = await fetch("/api/admin/billing-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json().catch(() => ({}))) as { pageUrl?: string; error?: string };
      if (!res.ok || !body.pageUrl) throw new Error(body.error ?? "");
      window.location.assign(body.pageUrl);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("common.networkError"));
      setBusy(null);
    }
  };

  const stop = async () => {
    setBusy("stop");
    setError("");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "");
      setStopped(true);
      await load();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("common.networkError"));
    } finally {
      setBusy(null);
    }
  };

  let how: string;
  if (testSub?.bankSubscription) how = t("subs.test.byBank");
  else if (testSub?.hasCardToken) how = t("subs.test.byCard", { card: testSub.maskedPan ? `•• ${testSub.maskedPan.slice(-4)}` : "••" });
  else how = t("subs.test.noCard");

  return (
    <FormPanel>
      <FormSection id="test-subscription" title={t("subs.test.title")} description={t("subs.test.description", { amount })}>
        {error && (
          <div role="alert" className={BANNER.err}>
            {error}
          </div>
        )}

        {!state.configured ? (
          <p className="text-[13px] text-[var(--foreground-muted)]">{t("subs.test.off")}</p>
        ) : running && testSub ? (
          <>
            <div className="flex flex-col gap-1 text-[13px]">
              <p className="text-[var(--foreground)]">{t("subs.test.running", { plan: t(planKey(testSub.plan)), amount })}</p>
              {testSub.currentPeriodEnd && (
                <p className="text-[var(--foreground-muted)]">{t("subs.test.next", { date: f.dateTime(testSub.currentPeriodEnd) })}</p>
              )}
              <p className="text-[var(--foreground-muted)]">{how}</p>
            </div>
            <div>
              <button type="button" className={BTN_DANGER} onClick={stop} disabled={busy !== null}>
                {busy === "stop" ? t("subs.test.stopping") : t("subs.test.stop")}
              </button>
            </div>
          </>
        ) : state.realPlanRunning ? (
          <p className="text-[13px] text-[var(--foreground-muted)]">{t("subs.test.realPlan")}</p>
        ) : (
          <>
            {stopped && <p className="text-[13px] text-[var(--foreground-muted)]">{t("subs.test.stopped")}</p>}
            {pending && testSub && (
              <p className="text-[13px] text-[var(--foreground-muted)]">
                {t("subs.test.pending", { plan: t(planKey(testSub.plan)), amount })}
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="test-plan" className={FIELD_LABEL}>
                  {t("subs.test.plan")}
                </label>
                <select id="test-plan" className={SELECT} value={plan} onChange={(e) => setPlan(e.target.value)}>
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t(p.label)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className={BTN_PRIMARY} onClick={start} disabled={busy !== null}>
                {busy === "start" ? t("subs.test.starting") : t("subs.test.start", { amount })}
              </button>
            </div>
            <p className="text-[12px] leading-[18px] text-[var(--foreground-muted)]">{t("subs.test.how", { amount })}</p>
          </>
        )}
      </FormSection>
    </FormPanel>
  );
}
