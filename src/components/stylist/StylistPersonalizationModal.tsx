"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface StylistPersonalization {
  nickname: string;
  pronouns: string;
  styleGoals: string[];
  hardLimits: string;
  lifestyle: string;
}

// ── Static data ────────────────────────────────────────────────────────────────
export const STYLE_GOALS = [
  "Look polished",
  "Express creativity",
  "Feel comfortable",
  "Stay on-trend",
  "Be sustainable",
  "Look effortless",
  "Make a statement",
];

export const LIFESTYLE_OPTIONS = [
  { id: "casual",       label: "Mostly casual",            desc: "Weekends, relaxed outings" },
  { id: "mixed",        label: "Mixed casual & formal",    desc: "Variety through the week" },
  { id: "professional", label: "Mostly professional",      desc: "Office-first wardrobe" },
  { id: "active",       label: "Active / sporty",          desc: "Movement is part of the day" },
  { id: "creative",     label: "Creative environment",     desc: "Art, fashion, design world" },
];

export const PRONOUNS_OPTIONS = ["she/her", "he/him", "they/them", "Skip"];

const TOTAL_STEPS = 5;

/* A choice chip. Phones: the §12.10 chip, `after:` stretching it to a 44px
   target; desktop: the square outlined caps chip it always was. */
const CHIP = "relative h-9 px-3.5 rounded-full text-[13px] max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1 md:h-auto md:rounded-none md:px-4 md:text-[10px] md:tracking-[0.10em] md:uppercase border transition-colors duration-200";
const CHIP_OFF = "border-transparent bg-[var(--fg-overlay-08)] text-[var(--foreground)] md:bg-transparent md:border-[var(--border)] md:text-[var(--foreground-muted)] md:hover:border-[var(--foreground)] md:hover:text-[var(--foreground)]";

const STEP_TITLES = [
  "What should we call you?",
  "What are your style goals?",
  "What should GOO never suggest?",
  "What's your typical lifestyle?",
  "You're all set.",
];

// ── Component ──────────────────────────────────────────────────────────────────
export function StylistPersonalizationModal({
  initial,
  userName,
  onClose,
  onSave,
}: {
  initial: StylistPersonalization | null;
  userName: string;
  onClose: () => void;
  onSave: (data: StylistPersonalization) => Promise<void>;
}) {
  const [step, setStep]           = useState(0);
  const [saving, setSaving]       = useState(false);
  const [nickname, setNickname]   = useState(initial?.nickname ?? userName ?? "");
  const [pronouns, setPronouns]   = useState(initial?.pronouns ?? "");
  const [styleGoals, setStyleGoals] = useState<string[]>(initial?.styleGoals ?? []);
  const [hardLimits, setHardLimits] = useState(initial?.hardLimits ?? "");
  const [lifestyle, setLifestyle]   = useState(initial?.lifestyle ?? "");

  const toggleGoal = (g: string) =>
    setStyleGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);

  const canProceed = () => {
    if (step === 1) return styleGoals.length > 0;
    if (step === 3) return !!lifestyle;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ nickname, pronouns, styleGoals, hardLimits, lifestyle });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      /* Выход здесь не анимируется: модалку монтируют и размонтируют
         родители (`profile`, `subscribe`), собственного `open` у неё нет, и
         добавить его значило бы держать её смонтированной всегда — то есть
         менять поведение формы между открытиями. Вход через `@starting-style`
         работает и так, скрим больше не включается мгновенно. */
      /* Phones: a sheet from the bottom on the common scrim (DESIGN_SYSTEM.md §12.7);
         desktop keeps the centred window. */
      className="ov-scrim fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/60 md:bg-[var(--background)]/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="ov-panel relative bg-[var(--surface)] md:bg-[var(--background)] md:border md:border-[var(--border)] rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[calc(100%-56px)] overflow-y-auto overscroll-contain md:max-h-none md:overflow-visible px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)] md:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="md:hidden mx-auto mb-4 w-9 h-1 rounded-full bg-[var(--border-strong)]" />

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center md:block md:w-auto md:h-auto md:top-5 md:right-5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors md:p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Progress */}
        <div className="flex gap-1.5 mt-8 mb-6 md:mt-0 md:mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 transition-colors duration-300 ${i <= step ? "bg-[var(--foreground)]" : "bg-[var(--border)]"}`}
            />
          ))}
        </div>

        <p className="text-[13px] text-[var(--foreground-muted)] md:text-[9px] md:tracking-[0.16em] md:uppercase md:text-[var(--foreground-subtle)] mb-1.5 md:mb-3">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <h2 className="text-[20px] font-semibold md:text-2xl md:font-bold text-[var(--foreground)] mb-5 md:mb-6">
          {STEP_TITLES[step]}
        </h2>

        <div className="min-h-[200px]">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="text-[13px] text-[var(--foreground-muted)] md:text-[10px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)] block mb-2">
                  Name or nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your name or nickname"
                  autoFocus
                  className="w-full bg-[var(--background)] md:bg-transparent border border-[var(--border)] max-md:rounded-2xl! md:rounded-none text-base md:text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none max-md:outline-none! focus:border-[var(--foreground)] transition-colors duration-200"
                />
              </div>
              <div>
                <label className="text-[13px] text-[var(--foreground-muted)] md:text-[10px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)] block mb-3">
                  Pronouns
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRONOUNS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPronouns(p === pronouns ? "" : p)}
                      className={`${CHIP} md:py-2 ${
                        pronouns === p
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : CHIP_OFF
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-[14px] md:text-xs text-[var(--foreground-muted)] mb-4 md:mb-5">
                Select everything that matters to you.
              </p>
              <div className="flex flex-wrap gap-2">
                {STYLE_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGoal(g)}
                    className={`${CHIP} md:py-2.5 ${
                      styleGoals.includes(g)
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                        : CHIP_OFF
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[14px] md:text-xs text-[var(--foreground-muted)] leading-relaxed">
                Be as specific as you like. GOO will never suggest these.
              </p>
              <textarea
                value={hardLimits}
                onChange={(e) => setHardLimits(e.target.value)}
                placeholder="e.g. no animal prints, nothing too revealing, avoid fast fashion brands..."
                rows={5}
                className="w-full bg-[var(--background)] md:bg-transparent border border-[var(--border)] max-md:rounded-2xl! md:rounded-none text-base md:text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none max-md:outline-none! focus:border-[var(--foreground)] transition-colors duration-200 resize-none"
              />
              <p className="text-[12px] md:text-[10px] text-[var(--foreground-subtle)]">Optional — skip if nothing applies.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              {LIFESTYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLifestyle(opt.id)}
                  className={`w-full p-4 text-left border rounded-2xl md:rounded-none transition-colors duration-200 flex items-center justify-between ${
                    lifestyle === opt.id
                      ? "border-[var(--foreground)] bg-[var(--foreground)]"
                      : "border-transparent bg-[var(--fg-overlay-05)] md:bg-transparent md:border-[var(--border)] md:hover:border-[var(--foreground-subtle)]"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${lifestyle === opt.id ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                      {opt.label}
                    </p>
                    <p className={`text-[13px] md:text-xs mt-0.5 ${lifestyle === opt.id ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                      {opt.desc}
                    </p>
                  </div>
                  {lifestyle === opt.id && (
                    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" className="shrink-0 ml-3">
                      <path d="M1 5.5L5 9.5L13 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                GOO&apos;s AI stylist is personalized to you. These preferences are applied to every recommendation.
              </p>
              <div className="p-4 rounded-2xl bg-[var(--fg-overlay-05)] md:rounded-none md:bg-transparent md:border md:border-[var(--border)] space-y-3">
                {nickname && (
                  <p className="text-[14px] md:text-xs text-[var(--foreground-muted)]">
                    <span className="text-[var(--foreground-subtle)] mr-2">Name:</span>
                    <span className="text-[var(--foreground)]">{nickname}</span>
                    {pronouns && pronouns !== "Skip" && (
                      <span className="text-[var(--foreground-muted)] ml-1">({pronouns})</span>
                    )}
                  </p>
                )}
                {styleGoals.length > 0 && (
                  <div>
                    <p className="text-[14px] md:text-xs text-[var(--foreground-subtle)] mb-1.5">Goals:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {styleGoals.map((g) => (
                        <span key={g} className="text-[12px] md:text-[10px] md:tracking-[0.08em] rounded-full md:rounded-none bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] px-2.5 py-1 text-[var(--foreground-muted)]">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {lifestyle && (
                  <p className="text-[14px] md:text-xs text-[var(--foreground-muted)]">
                    <span className="text-[var(--foreground-subtle)] mr-2">Lifestyle:</span>
                    <span className="text-[var(--foreground)]">
                      {LIFESTYLE_OPTIONS.find((o) => o.id === lifestyle)?.label}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 md:mt-8 md:pt-6 border-t border-[var(--border)]">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="h-11 -ml-3 px-3 text-[15px] md:h-auto md:ml-0 md:px-0 md:text-xs md:tracking-[0.12em] md:uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="h-12 rounded-full text-[15px] font-semibold md:h-auto md:rounded-none md:text-xs md:tracking-[0.14em] md:uppercase md:font-medium text-[var(--background)] bg-[var(--foreground)] px-6 md:py-3 hover:opacity-80 transition-opacity disabled:opacity-30"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-12 rounded-full text-[15px] font-semibold md:h-auto md:rounded-none md:text-xs md:tracking-[0.14em] md:uppercase md:font-medium text-[var(--background)] bg-[var(--foreground)] px-6 md:py-3 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save & finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
