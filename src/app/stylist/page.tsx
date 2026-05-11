"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const occasions: { id: Occasion; label: string; description: string; icon: string }[] = [
  { id: "casual",  label: "Casual",   description: "Everyday comfort, elevated", icon: "☀" },
  { id: "work",    label: "Work",     description: "Professional, considered",    icon: "◈" },
  { id: "evening", label: "Evening",  description: "After hours, refined",        icon: "◐" },
  { id: "formal",  label: "Formal",   description: "Event dressing, precise",     icon: "◆" },
  { id: "weekend", label: "Weekend",  description: "Relaxed, unhurried",          icon: "◎" },
  { id: "sport",   label: "Sport",    description: "Functional, minimal",         icon: "▲" },
];

const styleKeywords: { id: StyleKeyword; label: string; description: string }[] = [
  { id: "minimal",      label: "Minimal",      description: "Less is more" },
  { id: "classic",      label: "Classic",      description: "Timeless, refined" },
  { id: "avant-garde",  label: "Avant-Garde",  description: "Experimental, bold" },
  { id: "streetwear",   label: "Streetwear",   description: "Urban, relaxed" },
  { id: "romantic",     label: "Romantic",     description: "Soft, feminine" },
  { id: "utilitarian",  label: "Utilitarian",  description: "Function first" },
  { id: "bohemian",     label: "Bohemian",     description: "Free-spirited, layered" },
  { id: "preppy",       label: "Preppy",       description: "Polished, collegiate" },
  { id: "sporty",       label: "Sporty",       description: "Active, athletic-inspired" },
  { id: "dark",         label: "Dark",         description: "Moody, edgy tones" },
  { id: "maximalist",   label: "Maximalist",   description: "More is more" },
  { id: "coastal",      label: "Coastal",      description: "Breezy, natural" },
];

const palettes: { id: string; label: string; colors: string[] }[] = [
  { id: "neutral",    label: "Neutral",    colors: ["#F5F0E8", "#C8BEA8", "#8A7D6B", "#3D3530"] },
  { id: "monochrome", label: "Monochrome", colors: ["#F8F8F8", "#AAAAAA", "#555555", "#111111"] },
  { id: "earth",      label: "Earth",      colors: ["#E8D5B0", "#B5896A", "#7A4F35", "#3B2314"] },
  { id: "cool",       label: "Cool",       colors: ["#E8EEF5", "#9BB0C8", "#4A6E90", "#1A3550"] },
  { id: "warm",       label: "Warm",       colors: ["#F5EAD8", "#D4956A", "#B05C30", "#6B2D10"] },
  { id: "muted",      label: "Muted",      colors: ["#E8E4DC", "#BDB8AE", "#8A8580", "#4A4740"] },
  { id: "forest",     label: "Forest",     colors: ["#EAF0E8", "#A8BF9E", "#5A7A52", "#2A3E28"] },
  { id: "navy",       label: "Navy",       colors: ["#EDF0F5", "#9AAAC0", "#2E4A6E", "#0F1E30"] },
  { id: "jewel",      label: "Jewel",      colors: ["#8B3A8B", "#2E6B9E", "#1A7A52", "#B8840A"] },
  { id: "pastel",     label: "Pastel",     colors: ["#F8E8F0", "#F0D8E8", "#D8E8F8", "#E8F8E8"] },
  { id: "rose",       label: "Rose",       colors: ["#FCF0EE", "#EEC0B4", "#D4806A", "#8A3828"] },
  { id: "slate",      label: "Slate",      colors: ["#EEF0F2", "#B0B8C0", "#607080", "#283040"] },
];

const fitOptions = [
  { id: "fitted",    label: "Fitted",    description: "Close to the body, defined silhouette" },
  { id: "balanced",  label: "Balanced",  description: "Classic fit, proportioned" },
  { id: "relaxed",   label: "Relaxed",   description: "Ease and room to move" },
  { id: "oversized", label: "Oversized", description: "Volume-forward, street-inspired" },
];

const seasonOptions = [
  { id: "spring",   label: "Spring / Summer",   description: "Light layers, breathable fabrics" },
  { id: "autumn",   label: "Autumn / Winter",   description: "Warm layers, rich textures" },
  { id: "all",      label: "Year-Round",         description: "Transitional, versatile pieces" },
  { id: "occasion", label: "Special Occasion",   description: "Event-specific styling" },
];

const budgetPresets = [
  { label: "Student",  min: 30,   max: 150   },
  { label: "Entry",    min: 150,  max: 500   },
  { label: "Mid",      min: 500,  max: 1200  },
  { label: "Premium",  min: 1200, max: 3000  },
  { label: "Designer", min: 3000, max: 8000  },
  { label: "Couture",  min: 8000, max: 30000 },
];

const LOADING_MESSAGES = [
  "Analysing your aesthetic…",
  "Curating pieces from 50+ brands…",
  "Comparing prices across stores…",
  "Composing your final look…",
];

const steps: Step[] = ["occasion", "style", "palette", "fit", "season", "budget", "result"];

const STEP_LABELS: Record<Step, string> = {
  occasion: "Occasion",
  style:    "Aesthetic",
  palette:  "Palette",
  fit:      "Fit",
  season:   "Season",
  budget:   "Budget",
  result:   "Result",
};

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
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const { formatPrice } = useCurrency();

  const stepIndex  = steps.indexOf(currentStep);
  const totalSteps = steps.length - 1; // "result" is not a numbered step
  const progress   = (stepIndex / totalSteps) * 100;

  const prevStepIndex = useRef(stepIndex);
  const direction     = stepIndex >= prevStepIndex.current ? 1 : -1;
  useEffect(() => { prevStepIndex.current = stepIndex; }, [stepIndex]);

  // Cycle through loading messages
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 600);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setLoadingMsgIdx(0);
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

  const slideVariants = {
    enter:   (dir: number) => ({ opacity: 0, x: dir * 40 }),
    center:  { opacity: 1, x: 0 },
    exit:    (dir: number) => ({ opacity: 0, x: -dir * 40 }),
  };

  return (
    <div className="min-h-screen">
      {currentStep !== "result" ? (
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">

          {/* ── Progress stepper ── */}
          <div className="pt-12 md:pt-16 mb-14">
            {/* Step dots */}
            <div className="flex items-center gap-0 mb-6 max-w-2xl mx-auto">
              {steps.slice(0, totalSteps).map((step, i) => {
                const done    = i < stepIndex;
                const current = i === stepIndex;
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                          done    ? "bg-[var(--foreground)] text-[var(--background)]"
                          : current ? "bg-[var(--foreground)] text-[var(--background)] ring-4 ring-[var(--foreground)]/10"
                          : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-subtle)]"
                        }`}
                      >
                        {done ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.5 7.5L8.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`text-[8px] tracking-[0.14em] uppercase font-medium hidden sm:block transition-colors duration-200 ${
                        current ? "text-[var(--foreground)]" : done ? "text-[var(--foreground-muted)]" : "text-[var(--foreground-subtle)]"
                      }`}>
                        {STEP_LABELS[step]}
                      </span>
                    </div>
                    {i < totalSteps - 1 && (
                      <div className="flex-1 h-px mx-2 relative overflow-hidden bg-[var(--border)]">
                        <div
                          className="absolute left-0 top-0 h-full bg-[var(--foreground)] transition-all duration-500"
                          style={{ width: i < stepIndex ? "100%" : "0%" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Back button row */}
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] font-mono">
                {Math.round(progress)}% complete
              </p>
              {stepIndex > 0 && (
                <button
                  onClick={back}
                  className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] uppercase font-mono text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M6 2L3 5L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait" custom={direction}>

            {/* ── OCCASION ── */}
            {currentStep === "occasion" && (
              <motion.div
                key="occasion"
                className="max-w-2xl mx-auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                <div className="mb-10">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">Step 1</p>
                  <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-3">
                    What&apos;s the<br />occasion?
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    GOO will build the outfit around your context.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {occasions.map((occ) => (
                    <button
                      key={occ.id}
                      onClick={() => {
                        setForm((f) => ({ ...f, occasion: occ.id }));
                        next("style");
                      }}
                      className={`p-6 text-left rounded-xl border transition-all duration-200 group ${
                        form.occasion === occ.id
                          ? "border-[var(--foreground)] bg-[var(--foreground)]"
                          : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:shadow-sm"
                      }`}
                    >
                      <span className={`text-xl block mb-3 transition-transform duration-200 group-hover:scale-110 ${
                        form.occasion === occ.id ? "grayscale-0" : ""
                      }`}>
                        {occ.icon}
                      </span>
                      <p className={`text-sm font-semibold mb-1 ${form.occasion === occ.id ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                        {occ.label}
                      </p>
                      <p className={`text-xs leading-snug ${form.occasion === occ.id ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                        {occ.description}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── STYLE ── */}
            {currentStep === "style" && (
              <motion.div
                key="style"
                className="max-w-2xl mx-auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                <div className="mb-10">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">Step 2</p>
                  <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-3">
                    Your aesthetic.
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Select all that feel right. You can choose multiple.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        className={`p-5 text-left rounded-xl border transition-all duration-200 relative ${
                          selected
                            ? "bg-[var(--foreground)] border-[var(--foreground)]"
                            : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:shadow-sm"
                        }`}
                      >
                        {selected && (
                          <span className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-[var(--background)]/20 flex items-center justify-center">
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5L4.5 7.5L8.5 3" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                        <p className={`text-sm font-semibold mb-1 ${selected ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                          {style.label}
                        </p>
                        <p className={`text-xs leading-snug ${selected ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                          {style.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex items-center gap-5">
                  <button
                    onClick={() => next("palette")}
                    disabled={form.styles.length === 0}
                    className="font-mono text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-80 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue {form.styles.length > 0 && `(${form.styles.length})`}
                  </button>
                  <button
                    onClick={() => next("palette")}
                    className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── PALETTE ── */}
            {currentStep === "palette" && (
              <motion.div
                key="palette"
                className="max-w-2xl mx-auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                <div className="mb-10">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">Step 3</p>
                  <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-3">
                    Your color world.
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    What palette speaks to you right now?
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        className={`p-4 text-left rounded-xl border transition-all duration-200 relative overflow-hidden ${
                          selected
                            ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]"
                            : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:shadow-sm"
                        }`}
                      >
                        {/* Color bar strip */}
                        <div className="flex h-8 rounded-lg overflow-hidden mb-3">
                          {pal.colors.map((color, i) => (
                            <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-[var(--foreground)]">{pal.label}</p>
                          {selected && (
                            <span className="w-4 h-4 rounded-full bg-[var(--foreground)] flex items-center justify-center flex-shrink-0">
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5L4.5 7.5L8.5 3" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex items-center gap-5">
                  <button
                    onClick={() => next("fit")}
                    disabled={form.palette.length === 0}
                    className="font-mono text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-80 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Continue {form.palette.length > 0 && `(${form.palette.length})`}
                  </button>
                  <button
                    onClick={() => next("fit")}
                    className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── FIT ── */}
            {currentStep === "fit" && (
              <motion.div
                key="fit"
                className="max-w-2xl mx-auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                <div className="mb-10">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">Step 4</p>
                  <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-3">
                    How do you like<br />to wear clothes?
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Your preferred silhouette and fit.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fitOptions.map((opt) => {
                    const selected = form.fit === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, fit: opt.id }));
                          next("season");
                        }}
                        className={`p-7 text-left rounded-xl border transition-all duration-200 ${
                          selected
                            ? "border-[var(--foreground)] bg-[var(--foreground)]"
                            : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:shadow-sm"
                        }`}
                      >
                        <p className={`text-base font-semibold mb-2 ${selected ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                          {opt.label}
                        </p>
                        <p className={`text-xs leading-relaxed ${selected ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => next("season")}
                    className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── SEASON ── */}
            {currentStep === "season" && (
              <motion.div
                key="season"
                className="max-w-2xl mx-auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                <div className="mb-10">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">Step 5</p>
                  <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-3">
                    What&apos;s the season?
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    We&apos;ll tailor fabrics and layering for your climate.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {seasonOptions.map((opt) => {
                    const selected = form.season === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, season: opt.id }));
                          next("budget");
                        }}
                        className={`p-7 text-left rounded-xl border transition-all duration-200 ${
                          selected
                            ? "border-[var(--foreground)] bg-[var(--foreground)]"
                            : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:shadow-sm"
                        }`}
                      >
                        <p className={`text-base font-semibold mb-2 ${selected ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                          {opt.label}
                        </p>
                        <p className={`text-xs leading-relaxed ${selected ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => next("budget")}
                    className="font-mono text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── BUDGET ── */}
            {currentStep === "budget" && (
              <motion.div
                key="budget"
                className="max-w-2xl mx-auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >
                <div className="mb-10">
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-3">Step 6</p>
                  <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] mb-3">
                    What&apos;s your budget?
                  </h1>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Total outfit budget. We&apos;ll find the best prices across all stores.
                  </p>
                </div>

                {/* Active range display */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-1">
                      Selected range
                    </p>
                    <p className="text-3xl font-bold text-[var(--foreground)]">
                      {formatPrice(form.budgetMin)}
                      <span className="text-[var(--foreground-muted)] mx-2 font-light">—</span>
                      {formatPrice(form.budgetMax)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full border border-[var(--border)] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2v14M2 9h14" stroke="var(--foreground-subtle)" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {budgetPresets.map((preset) => {
                    const active = form.budgetMin === preset.min && form.budgetMax === preset.max;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => setForm((f) => ({ ...f, budgetMin: preset.min, budgetMax: preset.max }))}
                        className={`p-5 text-left rounded-xl border transition-all duration-200 ${
                          active
                            ? "bg-[var(--foreground)] border-[var(--foreground)]"
                            : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:shadow-sm"
                        }`}
                      >
                        <p className={`text-sm font-semibold mb-1 ${active ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                          {preset.label}
                        </p>
                        <p className={`font-mono text-xs ${active ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                          {formatPrice(preset.min)}–{formatPrice(preset.max)}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-10">
                  <button
                    onClick={handleGenerate}
                    className="font-mono w-full md:w-auto flex items-center justify-center gap-3 text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-12 py-4 rounded-xl hover:opacity-80 transition-opacity duration-200"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    Generate My Outfit
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Selection summary strip */}
          <AnimatePresence>
            {(form.occasion || form.styles.length > 0 || form.palette.length > 0) && currentStep !== "occasion" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="max-w-2xl mx-auto mt-12 mb-8 flex flex-wrap gap-2"
              >
                {form.occasion && (
                  <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                    {form.occasion}
                  </span>
                )}
                {form.styles.slice(0, 3).map((s) => (
                  <span key={s} className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                    {s}
                  </span>
                ))}
                {form.styles.length > 3 && (
                  <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-subtle)] border border-[var(--border)] px-3 py-1.5 rounded-full">
                    +{form.styles.length - 3} more
                  </span>
                )}
                {form.palette.slice(0, 2).map((p) => {
                  const pal = palettes.find((x) => x.id === p);
                  return pal ? (
                    <span key={p} className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                      <span className="flex gap-0.5">
                        {pal.colors.slice(0, 3).map((c, i) => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      {pal.label}
                    </span>
                  ) : null;
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pb-20" />
        </div>

      ) : (
        /* ─── RESULT / LOADING ─── */
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-[70vh] flex flex-col items-center justify-center gap-8"
              >
                {/* Animated rings */}
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border border-[var(--border)] animate-ping opacity-20" />
                  <div className="absolute inset-2 rounded-full border border-[var(--foreground)]/20 animate-spin" style={{ animationDuration: "3s" }} />
                  <div className="absolute inset-0 rounded-full border-t border-[var(--foreground)] animate-spin" style={{ animationDuration: "1s" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" stroke="var(--foreground)" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="text-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingMsgIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="font-mono text-sm text-[var(--foreground-muted)] tracking-[0.06em]"
                    >
                      {LOADING_MESSAGES[loadingMsgIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Loading bar */}
                <div className="w-48 h-px bg-[var(--border)] relative overflow-hidden rounded-full">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-[var(--foreground)]"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.4, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <div className="pt-12 md:pt-16 mb-10">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                        AI Generated
                      </p>
                      <h1 className="text-3xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05]">
                        Your outfits<br />are ready.
                      </h1>
                      <p className="mt-3 text-sm text-[var(--foreground-muted)]">
                        {generatedOutfits.length} outfits curated for{" "}
                        <span className="text-[var(--foreground)] capitalize font-medium">{form.occasion || "you"}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <button
                        onClick={() => {
                          setCurrentStep("occasion");
                          setForm({ occasion: null, styles: [], palette: [], fit: null, season: null, budgetMin: 500, budgetMax: 1500 });
                        }}
                        className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 border border-[var(--border)] px-5 py-2.5 rounded-xl hover:border-[var(--foreground-muted)]"
                      >
                        Start over
                      </button>
                      <button
                        onClick={handleGenerate}
                        className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--background)] bg-[var(--foreground)] px-5 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Style summary strip */}
                {(form.occasion || form.styles.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-10">
                    {form.occasion && (
                      <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground)] border border-[var(--foreground)] px-3 py-1.5 rounded-full">
                        {form.occasion}
                      </span>
                    )}
                    {form.styles.map((s) => (
                      <span key={s} className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                        {s}
                      </span>
                    ))}
                    {form.fit && (
                      <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                        {form.fit}
                      </span>
                    )}
                    {form.palette.map((p) => {
                      const pal = palettes.find((x) => x.id === p);
                      return pal ? (
                        <span key={p} className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                          <span className="flex gap-0.5">
                            {pal.colors.slice(0, 3).map((c, i) => (
                              <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                            ))}
                          </span>
                          {pal.label}
                        </span>
                      ) : null;
                    })}
                    <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 rounded-full">
                      {formatPrice(form.budgetMin)}–{formatPrice(form.budgetMax)}
                    </span>
                  </div>
                )}

                <motion.div
                  className="grid grid-cols-2 md:grid-cols-4 gap-4"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.08 } } }}
                >
                  {generatedOutfits.map((outfit) => (
                    <motion.div
                      key={outfit.id}
                      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="rounded-xl overflow-hidden hover:shadow-md transition-all duration-200"
                    >
                      <OutfitCard outfit={outfit} />
                    </motion.div>
                  ))}
                </motion.div>

                <div className="mt-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-1">Want unlimited outfits?</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      Upgrade to GOO Plus for unlimited AI generations, stylist memory, and exclusive styles.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href="/plans"
                      className="font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-3 rounded-xl hover:opacity-80 transition-opacity"
                    >
                      See plans
                    </Link>
                    <Link
                      href="/browse"
                      className="font-mono text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] px-6 py-3 rounded-xl hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-200"
                    >
                      Browse all
                    </Link>
                  </div>
                </div>

                <div className="mb-20" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
