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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--background)] border border-[var(--border)] w-full max-w-lg p-8 animate-fade-up shadow-2xl">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 transition-colors duration-300 ${i <= step ? "bg-[var(--foreground)]" : "bg-[var(--border)]"}`}
            />
          ))}
        </div>

        <p className="text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-3">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">
          {STEP_TITLES[step]}
        </h2>

        <div className="min-h-[200px]">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] block mb-2">
                  Name or nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your name or nickname"
                  autoFocus
                  className="glass-field w-full rounded-lg text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none transition-colors duration-200"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] block mb-3">
                  Pronouns
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRONOUNS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPronouns(p === pronouns ? "" : p)}
                      className={`text-[10px] tracking-[0.10em] uppercase px-4 py-2 border transition-all duration-200 ${
                        pronouns === p
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
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
              <p className="text-xs text-[var(--foreground-muted)] mb-5">
                Select everything that matters to you.
              </p>
              <div className="flex flex-wrap gap-2">
                {STYLE_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGoal(g)}
                    className={`text-[10px] tracking-[0.10em] uppercase px-4 py-2.5 border transition-all duration-200 ${
                      styleGoals.includes(g)
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
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
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                Be as specific as you like. GOO will never suggest these.
              </p>
              <textarea
                value={hardLimits}
                onChange={(e) => setHardLimits(e.target.value)}
                placeholder="e.g. no animal prints, nothing too revealing, avoid fast fashion brands..."
                rows={5}
                className="glass-field w-full rounded-lg text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none transition-colors duration-200 resize-none"
              />
              <p className="text-[10px] text-[var(--foreground-subtle)]">Optional — skip if nothing applies.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              {LIFESTYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLifestyle(opt.id)}
                  className={`w-full p-4 text-left border transition-all duration-200 flex items-center justify-between ${
                    lifestyle === opt.id
                      ? "border-[var(--foreground)] bg-[var(--foreground)]"
                      : "border-[var(--border)] hover:border-[var(--foreground-subtle)]"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${lifestyle === opt.id ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                      {opt.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${lifestyle === opt.id ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
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
              <div className="p-4 border border-[var(--border)] space-y-3">
                {nickname && (
                  <p className="text-xs text-[var(--foreground-muted)]">
                    <span className="text-[var(--foreground-subtle)] mr-2">Name:</span>
                    <span className="text-[var(--foreground)]">{nickname}</span>
                    {pronouns && pronouns !== "Skip" && (
                      <span className="text-[var(--foreground-muted)] ml-1">({pronouns})</span>
                    )}
                  </p>
                )}
                {styleGoals.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--foreground-subtle)] mb-1.5">Goals:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {styleGoals.map((g) => (
                        <span key={g} className="text-[10px] tracking-[0.08em] border border-[var(--border)] px-2.5 py-1 text-[var(--foreground-muted)]">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {lifestyle && (
                  <p className="text-xs text-[var(--foreground-muted)]">
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
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border)]">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-30"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save & finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
