"use client";

import { useState } from "react";
import Link from "next/link";
import OutfitCard from "@/components/outfit/OutfitCard";
import { outfits } from "@/lib/data/outfits";
import { useCurrency } from "@/lib/context/currency-context";
import { Occasion, StyleKeyword } from "@/lib/types";

type Step = "occasion" | "style" | "palette" | "fit" | "season" | "budget" | "result";

interface FormState {
  occasion: Occasion | null;
  styles: StyleKeyword[];
  palette: string[];
  fit: string | null;
  season: string | null;
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

const styleKeywords: { id: StyleKeyword; label: string; description: string }[] = [
  { id: "minimal", label: "Minimal", description: "Less is more" },
  { id: "classic", label: "Classic", description: "Timeless, refined" },
  { id: "avant-garde", label: "Avant-Garde", description: "Experimental, bold" },
  { id: "streetwear", label: "Streetwear", description: "Urban, relaxed" },
  { id: "romantic", label: "Romantic", description: "Soft, feminine" },
  { id: "utilitarian", label: "Utilitarian", description: "Function first" },
  { id: "bohemian", label: "Bohemian", description: "Free-spirited, layered" },
  { id: "preppy", label: "Preppy", description: "Polished, collegiate" },
  { id: "sporty", label: "Sporty", description: "Active, athletic-inspired" },
  { id: "dark", label: "Dark", description: "Moody, edgy tones" },
  { id: "maximalist", label: "Maximalist", description: "More is more" },
  { id: "coastal", label: "Coastal", description: "Breezy, natural" },
];

const palettes: { id: string; label: string; colors: string[] }[] = [
  { id: "neutral", label: "Neutral", colors: ["#F5F0E8", "#C8BEA8", "#8A7D6B", "#3D3530"] },
  { id: "monochrome", label: "Monochrome", colors: ["#F8F8F8", "#AAAAAA", "#555555", "#111111"] },
  { id: "earth", label: "Earth", colors: ["#E8D5B0", "#B5896A", "#7A4F35", "#3B2314"] },
  { id: "cool", label: "Cool", colors: ["#E8EEF5", "#9BB0C8", "#4A6E90", "#1A3550"] },
  { id: "warm", label: "Warm", colors: ["#F5EAD8", "#D4956A", "#B05C30", "#6B2D10"] },
  { id: "muted", label: "Muted", colors: ["#E8E4DC", "#BDB8AE", "#8A8580", "#4A4740"] },
  { id: "forest", label: "Forest", colors: ["#EAF0E8", "#A8BF9E", "#5A7A52", "#2A3E28"] },
  { id: "navy", label: "Navy", colors: ["#EDF0F5", "#9AAAC0", "#2E4A6E", "#0F1E30"] },
  { id: "jewel", label: "Jewel", colors: ["#8B3A8B", "#2E6B9E", "#1A7A52", "#B8840A"] },
  { id: "pastel", label: "Pastel", colors: ["#F8E8F0", "#F0D8E8", "#D8E8F8", "#E8F8E8"] },
  { id: "rose", label: "Rose", colors: ["#FCF0EE", "#EEC0B4", "#D4806A", "#8A3828"] },
  { id: "slate", label: "Slate", colors: ["#EEF0F2", "#B0B8C0", "#607080", "#283040"] },
];

const fitOptions = [
  { id: "fitted", label: "Fitted", description: "Close to the body, defined silhouette" },
  { id: "balanced", label: "Balanced", description: "Classic fit, proportioned" },
  { id: "relaxed", label: "Relaxed", description: "Ease and room to move" },
  { id: "oversized", label: "Oversized", description: "Volume-forward, street-inspired" },
];

const seasonOptions = [
  { id: "spring", label: "Spring / Summer", description: "Light layers, breathable fabrics" },
  { id: "autumn", label: "Autumn / Winter", description: "Warm layers, rich textures" },
  { id: "all", label: "Year-Round", description: "Transitional, versatile pieces" },
  { id: "occasion", label: "Special Occasion", description: "Event-specific styling" },
];

const budgetPresets = [
  { label: "Student", min: 30, max: 150 },
  { label: "Entry", min: 150, max: 500 },
  { label: "Mid", min: 500, max: 1200 },
  { label: "Premium", min: 1200, max: 3000 },
  { label: "Designer", min: 3000, max: 8000 },
  { label: "Couture", min: 8000, max: 30000 },
];

const steps: Step[] = ["occasion", "style", "palette", "fit", "season", "budget", "result"];

export default function StylistPage() {
  const [currentStep, setCurrentStep] = useState<Step>("occasion");
  const [form, setForm] = useState<FormState>({
    occasion: null,
    styles: [],
    palette: [],
    fit: null,
    season: null,
    budgetMin: 500,
    budgetMax: 1500,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const { formatPrice } = useCurrency();

  const stepIndex = steps.indexOf(currentStep);
  const totalSteps = steps.length - 1;
  const progress = (stepIndex / totalSteps) * 100;

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setCurrentStep("result");
    }, 2400);
  };

  const generatedOutfits = outfits
    .filter((o) => !form.occasion || o.occasion === form.occasion)
    .slice(0, 4);

  const next = (step: Step) => setCurrentStep(step);
  const back = () => setCurrentStep(steps[stepIndex - 1]);

  return (
    <div className="min-h-screen pt-16">
      {currentStep !== "result" ? (
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          {/* Progress */}
          <div className="pt-12 md:pt-16 mb-12">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                Step {stepIndex + 1} of {totalSteps}
              </p>
              {stepIndex > 0 && (
                <button
                  onClick={back}
                  className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
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

          {/* ── OCCASION ── */}
          {currentStep === "occasion" && (
            <div className="max-w-2xl mx-auto">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                What&apos;s the occasion?
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-10">
                GOO will build the outfit around your context.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {occasions.map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, occasion: occ.id }));
                      next("style");
                    }}
                    className={`bg-[var(--background)] p-6 text-left hover:bg-[var(--surface)] transition-colors duration-200 ${
                      form.occasion === occ.id ? "ring-1 ring-inset ring-[var(--foreground)]" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--foreground)] mb-1">{occ.label}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{occ.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STYLE ── */}
          {currentStep === "style" && (
            <div className="max-w-2xl mx-auto">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                Your aesthetic.
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-10">
                Select all that feel right. You can choose multiple.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {styleKeywords.map((style) => {
                  const selected = form.styles.includes(style.id);
                  return (
                    <button
                      key={style.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          styles: selected
                            ? f.styles.filter((s) => s !== style.id)
                            : [...f.styles, style.id],
                        }))
                      }
                      className={`p-5 text-left transition-colors duration-200 relative ${
                        selected ? "bg-[var(--foreground)]" : "bg-[var(--background)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <p className={`text-sm font-medium ${selected ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                        {style.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${selected ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                        {style.description}
                      </p>
                      {selected && (
                        <span className="absolute top-3 right-3 text-[var(--background)]">
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => next("palette")}
                  disabled={form.styles.length === 0}
                  className="font-mono text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 hover:opacity-80 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button onClick={() => next("palette")} className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200">
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── PALETTE ── */}
          {currentStep === "palette" && (
            <div className="max-w-2xl mx-auto">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                Your color world.
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-10">
                What palette speaks to you right now? Choose one or several.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {palettes.map((pal) => {
                  const selected = form.palette.includes(pal.id);
                  return (
                    <button
                      key={pal.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          palette: selected ? f.palette.filter((p) => p !== pal.id) : [...f.palette, pal.id],
                        }))
                      }
                      className={`bg-[var(--background)] p-5 text-left transition-colors duration-200 ${
                        selected ? "ring-1 ring-inset ring-[var(--foreground)]" : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <div className="flex gap-1.5 mb-3">
                        {pal.colors.map((color, i) => (
                          <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <p className="text-sm font-medium text-[var(--foreground)]">{pal.label}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 flex gap-4">
                <button
                  onClick={() => next("fit")}
                  disabled={form.palette.length === 0}
                  className="font-mono text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 hover:opacity-80 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button onClick={() => next("fit")} className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200">
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── FIT ── */}
          {currentStep === "fit" && (
            <div className="max-w-2xl mx-auto">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                How do you like to wear clothes?
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-10">
                Your preferred silhouette and fit.
              </p>
              <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                {fitOptions.map((opt) => {
                  const selected = form.fit === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setForm((f) => ({ ...f, fit: opt.id }));
                        next("season");
                      }}
                      className={`bg-[var(--background)] p-6 text-left hover:bg-[var(--surface)] transition-colors duration-200 ${
                        selected ? "ring-1 ring-inset ring-[var(--foreground)]" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-[var(--foreground)] mb-1">{opt.label}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8">
                <button onClick={() => next("season")} className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200">
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── SEASON ── */}
          {currentStep === "season" && (
            <div className="max-w-2xl mx-auto">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                What&apos;s the season?
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-10">
                We&apos;ll tailor fabrics and layering for your climate.
              </p>
              <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                {seasonOptions.map((opt) => {
                  const selected = form.season === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setForm((f) => ({ ...f, season: opt.id }));
                        next("budget");
                      }}
                      className={`bg-[var(--background)] p-6 text-left hover:bg-[var(--surface)] transition-colors duration-200 ${
                        selected ? "ring-1 ring-inset ring-[var(--foreground)]" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-[var(--foreground)] mb-1">{opt.label}</p>
                      <p className="text-xs text-[var(--foreground-muted)]">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8">
                <button onClick={() => next("budget")} className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200">
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── BUDGET ── */}
          {currentStep === "budget" && (
            <div className="max-w-2xl mx-auto">
              <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-3">
                What&apos;s your budget?
              </h1>
              <p className="text-sm text-[var(--foreground-muted)] mb-10">
                Total outfit budget. We&apos;ll find the best prices across all stores.
              </p>

              <div className="border-b border-[var(--border)] pb-6 mb-8">
                <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-2">
                  Selected range
                </p>
                <p className="font-display text-3xl font-light text-[var(--foreground)]">
                  {formatPrice(form.budgetMin)} — {formatPrice(form.budgetMax)}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
                {budgetPresets.map((preset) => {
                  const active = form.budgetMin === preset.min && form.budgetMax === preset.max;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setForm((f) => ({ ...f, budgetMin: preset.min, budgetMax: preset.max }))}
                      className={`p-5 text-left transition-colors duration-200 ${
                        active ? "bg-[var(--foreground)]" : "bg-[var(--background)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <p className={`text-sm font-medium ${active ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                        {preset.label}
                      </p>
                      <p className={`font-mono text-xs mt-0.5 ${active ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                        {formatPrice(preset.min)}–{formatPrice(preset.max)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-10">
                <button
                  onClick={handleGenerate}
                  className="font-mono w-full md:w-auto text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-12 py-4 hover:opacity-80 transition-opacity duration-200"
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
              <p className="font-mono text-sm text-[var(--foreground-muted)] tracking-[0.06em]">Building your outfit…</p>
            </div>
          ) : (
            <>
              <div className="pt-12 md:pt-16 mb-12">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
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
                      setForm({ occasion: null, styles: [], palette: [], fit: null, season: null, budgetMin: 500, budgetMax: 1500 });
                    }}
                    className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 shrink-0 mt-1"
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
                {generatedOutfits.map((outfit) => (
                  <div key={outfit.id} className="bg-[var(--background)] p-3">
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
                  className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
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
