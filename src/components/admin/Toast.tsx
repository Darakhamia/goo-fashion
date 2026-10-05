"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useT } from "@/app/goo-studio/_i18n";

/*
 * The admin's one toast (docs/ADMIN_DESIGN.md 5.12, CEO decision Р14): a
 * panel bottom right with a status dot, the message and a close button.
 *
 *   const toast = useToast();
 *   toast.ok("Saved");
 *   toast.err(json.error || "Could not save");
 *
 * Success goes after 5 s, errors after 8 s — they are the ones worth reading.
 * The timer pauses while the pointer or focus is on the toast. A new toast
 * replaces the one on screen, so a burst of saves shows the latest result.
 * ToastProvider sits inside the admin root in goo-studio/_ui/AdminShell.tsx.
 */

type Tone = "ok" | "err" | "info";
type ToastApi = {
  ok: (message: string) => void;
  err: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast() needs ToastProvider (goo-studio/_ui/AdminShell.tsx)");
  return api;
}

const DOT: Record<Tone, string> = {
  ok: "bg-[var(--ok)]",
  err: "bg-[var(--err)]",
  info: "bg-[var(--foreground-muted)]",
};

const LIFETIME: Record<Tone, number> = { ok: 5000, info: 5000, err: 8000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; tone: Tone; message: string } | null>(null);
  const nextId = useRef(0);

  const show = useCallback((tone: Tone, message: string) => {
    nextId.current += 1;
    setToast({ id: nextId.current, tone, message });
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      ok: (m) => show("ok", m),
      err: (m) => show("err", m),
      info: (m) => show("info", m),
    }),
    [show]
  );
  const dismiss = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && <ToastView key={toast.id} tone={toast.tone} message={toast.message} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}

function ToastView({ tone, message, onDismiss }: { tone: Tone; message: string; onDismiss: () => void }) {
  const t = useT();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(LIFETIME[tone]);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, onDismiss]);

  return (
    <div
      role={tone === "err" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="ov-pop ov-pop-up fixed bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-[380px] z-[100] flex items-start gap-3 rounded-xl border border-[var(--border)] pl-4 pr-1.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      style={{ background: "var(--surface)" }}
    >
      <span className={`mt-[13px] w-2 h-2 rounded-full flex-shrink-0 ${DOT[tone]}`} aria-hidden="true" />
      <p className="flex-1 min-w-0 py-1.5 text-[13px] leading-5 text-[var(--foreground)] break-words">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.dismiss")}
        title={t("common.dismiss")}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
