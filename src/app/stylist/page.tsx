"use client";

import { useState } from "react";
import Link from "next/link";
import OutfitCard from "@/components/outfit/OutfitCard";
import { outfits } from "@/lib/data/outfits";
import { Occasion, StyleKeyword } from "@/lib/types";

type Step = "occasion" | "style" | "palette" | "budget" | "result";

interface FormState {
  occasion: Occasion | null;
  styles: StyleKeyword[];
  palette: string[];
  budgetMin: number;
  budgetMax: number;
}

const occasions: { id: Occasion; label: string; description: string }[] = [
  { id: "casual", label: "Casual", description: "Everyday comfort, elevated" },
  { id: "work", label: "Work", description: "Professional, considered" },
  { id: "evening", label: "Evening", description: "After hours, refined" },
  { id: "formal", label: "Formal", description: "Event dressing, precise" },
  { id: "weekend", label: "Weekend", description: "Relaxed, unhurried" },
  { id: "sport", label: "Sport", description: "Functional, minimal" },
];

const styleKeywords: { id: StyleKeyword; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "classic", label: "Classic" },
  { id: "avant-garde", label: "Avant-Garde" },
  { id: "streetwear", label: "Streetwear" },
  { id: "romantic", label: "Romantic" },
  { id: "utilitarian", label: "Utilitarian" },
];

const palettes: { id: string; label: string; colors: string[] }[] = [
  { id: "neutral", label: "Neutral", colors: ["#F5F0E8", "#C8BEA8", "#8A7D6B", "#3D3530"] },
  { id: "monochrome", label: "Monochrome", colors: ["#F8F8F8", "#AAAAAA", "#555555", "#111111"] },
  { id: "earth", label: "Earth", colors: ["#E8D5B0", "#B5896A", "#7A4F35", "#3B2314"] },
  { id: "cool", label: "Cool", colors: ["#E8EEF5", "#9BB0C8", "#4A6E90", "#1A3550"] },
  { id: "warm", label: "Warm", colors: ["#F5EAD8", "#D4956A", "#B05C30", "#6B2D10"] },
  { id: "muted", label: "Muted", colors: ["#E8E4DC", "#BDB8AE", "#8A8580", "#4A4740"] },
];

const steps: Step[] = ["occasion", "style", "palette", "budget", "result"];

export default function StylistPage() {
  const [currentStep, setCurrentStep] = useState<Step>("occasion");
  const [form, setForm] = useState<FormState>({
    occasion: null,
    styles: [],
    palette: [],
    budgetMin: 200,
    budgetMax: 1500,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const stepIndex = steps.indexOf(currentStep);
  const progress = (stepIndex / (steps.length - 1)) * 100;

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setCurrentStep("result");
    }, 2200);
  };

  const generatedOutfits = outfits.filter(
    (o) => !form.occasion || o.occasion === form.occasion
  ).slice(0, 3);

  return (
    <div className="min-h-screen pt-16">
      {currentStep !== "result" ? (
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          {/* Progress */}
          <div className="pt-12 md:pt-16 mb-12">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                {stepIndex + 1} of {steps.length - 1}
              </p>
              {stepIndex > 0 && (
                <button
                  onClick={() => setCurrentStep(steps[stepIndex - 1])}
                  className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                >
                  ← Back
                </button>
              )}
            </div>
            <div className="h-px bg-[var(--border)] relative">
              <div
                className="absolute top-0 left-0 h-full bg-[var(--foreground)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step: Occasion */}
          {currentStep === "occasion" && (
            <div className="max-w-3xl">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                What&apos;s the occasion?
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-12">
                GOO will build the outfit around your context.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {occasions.map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, occasion: occ.id }));
                      setCurrentStep("style");
                    }}
                    className={`bg-[var(--background)] p-6 text-left hover:bg-[var(--surface)] transition-colors duration-200 group ${
                      form.occasion === occ.id ? "bg-[var(--surface)]" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                      {occ.label}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">{occ.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Style */}
          {currentStep === "style" && (
            <div className="max-w-3xl">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                Your aesthetic.
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-12">
                Select all that feel right. You can choose multiple.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {styleKeywords.map((style) => {
                  const selected = form.styles.includes(style.id);
                  return (
                    <button
                      key={style.id}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          styles: selected
                            ? f.styles.filter((s) => s !== style.id)
                            : [...f.styles, style.id],
                        }));
                      }}
                      className={`bg-[var(--background)] p-6 text-left transition-colors duration-200 relative ${
                        selected ? "bg-[var(--foreground)]" : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          selected ? "text-[var(--background)]" : "text-[var(--foreground)]"
                        }`}
                      >
                        {style.label}
                      </p>
                      {selected && (
                        <span className="absolute top-3 right-3 text-[var(--background)]">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6L5 9L10 3"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => setCurrentStep("palette")}
                  disabled={form.styles.length === 0}
                  className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button
                  onClick={() => setCurrentStep("palette")}
                  className="text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step: Palette */}
          {currentStep === "palette" && (
            <div className="max-w-3xl">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                Your color world.
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-12">
                What palette speaks to you right now?
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {palettes.map((pal) => {
                  const selected = form.palette.includes(pal.id);
                  return (
                    <button
                      key={pal.id}
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          palette: selected
                            ? f.palette.filter((p) => p !== pal.id)
                            : [...f.palette, pal.id],
                        }));
                      }}
                      className={`bg-[var(--background)] p-6 text-left transition-colors duration-200 ${
                        selected
                          ? "ring-1 ring-inset ring-[var(--foreground)]"
                          : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <div className="flex gap-1.5 mb-3">
                        {pal.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <p className="text-sm font-medium text-[var(--foreground)]">{pal.label}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => setCurrentStep("budget")}
                  disabled={form.palette.length === 0}
                  className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button
                  onClick={() => setCurrentStep("budget")}
                  className="text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step: Budget */}
          {currentStep === "budget" && (
            <div className="max-w-xl">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                What&apos;s your budget?
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-12">
                Total outfit budget. We&apos;ll find the best prices across all stores.
              </p>

              <div className="space-y-8">
                {/* Budget display */}
                <div className="flex items-end justify-between border-b border-[var(--border)] pb-6">
                  <div>
                    <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-1">
                      Budget range
                    </p>
                    <p className="font-display text-3xl font-light text-[var(--foreground)]">
                      ${form.budgetMin.toLocaleString()} — ${form.budgetMax.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Preset options */}
                <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                  {[
                    { label: "Entry", min: 100, max: 400 },
                    { label: "Mid", min: 400, max: 900 },
                    { label: "Premium", min: 900, max: 2000 },
                    { label: "Luxury", min: 2000, max: 5000 },
                  ].map((preset) => {
                    const active =
                      form.budgetMin === preset.min && form.budgetMax === preset.max;
                    return (
                      <button
                        key={preset.label}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            budgetMin: preset.min,
                            budgetMax: preset.max,
                          }))
                        }
                        className={`p-5 text-left transition-colors duration-200 ${
                          active
                            ? "bg-[var(--foreground)]"
                            : "bg-[var(--background)] hover:bg-[var(--surface)]"
                        }`}
                      >
                        <p
                          className={`text-sm font-medium ${
                            active ? "text-[var(--background)]" : "text-[var(--foreground)]"
                          }`}
                        >
                          {preset.label}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            active
                              ? "text-[var(--fg-on-dark-70)]"
                              : "text-[var(--foreground-muted)]"
                          }`}
                        >
                          ${preset.min}–${preset.max.toLocaleString()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-10">
                <button
                  onClick={handleGenerate}
                  className="w-full md:w-auto text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-12 py-4 hover:opacity-80 transition-opacity duration-200"
                >
                  Generate Outfit
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── RESULT ─── */
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          {isGenerating ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
              <div className="w-8 h-8 border border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--foreground-muted)] tracking-[0.06em]">
                Building your outfit...
              </p>
            </div>
          ) : (
            <>
              <div className="pt-12 md:pt-16 mb-12">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                      AI Generated
                    </p>
                    <h1 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)]">
                      Your outfits are ready.
                    </h1>
                    <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                      {generatedOutfits.length} outfits curated for{" "}
                      <span className="text-[var(--foreground)] capitalize">{form.occasion || "you"}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentStep("occasion");
                      setForm({
                        occasion: null,
                        styles: [],
                        palette: [],
                        budgetMin: 200,
                        budgetMax: 1500,
                      });
                    }}
                    className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 shrink-0 mt-1"
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
                {generatedOutfits.map((outfit) => (
                  <div key={outfit.id} className="bg-[var(--background)] p-4">
                    <OutfitCard outfit={outfit} />
                  </div>
                ))}
              </div>

              <div className="mt-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-[var(--border)] pt-8">
                <p className="text-sm text-[var(--foreground-muted)]">
                  Want more options? Upgrade to{" "}
                  <Link href="/plans" className="text-[var(--foreground)] link-underline">
                    GOO Plus
                  </Link>{" "}
                  for unlimited generations.
                </p>
                <button
                  onClick={() => setCurrentStep("occasion")}
                  className="text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                >
                  Start over
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
