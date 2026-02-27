"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/lib/context/theme-context";

type BodyType = "slim" | "athletic" | "average" | "curvy" | "petite" | "tall";
type StyleKeyword =
  | "minimal" | "classic" | "streetwear" | "sporty" | "avant-garde"
  | "romantic" | "utilitarian" | "bohemian" | "preppy" | "dark"
  | "maximalist" | "coastal" | "academic";

const bodyTypes: { id: BodyType; label: string; description: string }[] = [
  { id: "slim", label: "Slim", description: "Lean, long proportions" },
  { id: "athletic", label: "Athletic", description: "Muscular, balanced frame" },
  { id: "average", label: "Average", description: "Balanced proportions" },
  { id: "curvy", label: "Curvy", description: "Defined waist, fuller frame" },
  { id: "petite", label: "Petite", description: "Compact, shorter frame" },
  { id: "tall", label: "Tall", description: "Elongated proportions" },
];

const STYLE_KEYWORDS: StyleKeyword[] = [
  "minimal", "classic", "streetwear", "sporty", "avant-garde",
  "romantic", "utilitarian", "bohemian", "preppy", "dark",
  "maximalist", "coastal", "academic",
];

const COLOR_PALETTE = [
  { name: "Ivory", hex: "#F5F0E8", light: true },
  { name: "Cream", hex: "#FFFDD0", light: true },
  { name: "Sand", hex: "#C8B89A", light: true },
  { name: "Blush", hex: "#E8B4A0", light: true },
  { name: "Camel", hex: "#C19A6B", light: false },
  { name: "Terracotta", hex: "#C0604A", light: false },
  { name: "Burgundy", hex: "#722F37", light: false },
  { name: "Stone", hex: "#928E85", light: false },
  { name: "Slate", hex: "#708090", light: false },
  { name: "Olive", hex: "#6B6B47", light: false },
  { name: "Forest", hex: "#2D4A2D", light: false },
  { name: "Navy", hex: "#1B2A4A", light: false },
  { name: "Cobalt", hex: "#0047AB", light: false },
  { name: "Charcoal", hex: "#36454F", light: false },
  { name: "Chocolate", hex: "#5C3D2E", light: false },
  { name: "Midnight", hex: "#0A0A0A", light: false },
];

const BUDGET_OPTIONS = [
  { label: "Entry", range: "$100–400" },
  { label: "Mid", range: "$400–900" },
  { label: "Premium", range: "$900–2000" },
  { label: "Luxury", range: "$2000+" },
];

export default function ProfilePage() {
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<StyleKeyword[]>([]);
  const [saved, setSaved] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const toggleColor = (hex: string) => {
    setSelectedColors((prev) =>
      prev.includes(hex)
        ? prev.filter((c) => c !== hex)
        : prev.length < 6
        ? [...prev, hex]
        : prev
    );
    setSaved(false);
  };

  const toggleStyle = (s: StyleKeyword) => {
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setSaved(false);
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 max-w-2xl animate-fade-up">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Profile
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] mb-2">
            Your style profile.
          </h1>
          <p className="text-sm text-[var(--foreground-muted)] mb-12 leading-relaxed">
            The more GOO knows, the better it styles you. Your data stays private.
          </p>

          {/* Plan Badge */}
          <div className="flex items-center gap-3 mb-12 p-4 border border-[var(--border)]">
            <div className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
            <p className="text-xs text-[var(--foreground-muted)]">
              You are on the{" "}
              <span className="text-[var(--foreground)] font-medium">Free plan</span>.{" "}
              <Link href="/plans" className="link-underline text-[var(--foreground)]">
                Upgrade
              </Link>
            </p>
          </div>

          {/* ── Colour Palette ── */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                Colour palette
              </p>
              <span className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-subtle)]">
                {selectedColors.length} / 6 selected
              </span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mb-5">
              Pick up to 6 colours you gravitate towards. GOO uses these to match outfits to your taste.
            </p>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_PALETTE.map((color) => {
                const isSelected = selectedColors.includes(color.hex);
                const atMax = selectedColors.length >= 6 && !isSelected;
                return (
                  <button
                    key={color.hex}
                    onClick={() => toggleColor(color.hex)}
                    title={color.name}
                    disabled={atMax}
                    className={`group relative aspect-square transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-[var(--foreground)] ring-offset-[var(--background)] scale-105"
                        : atMax
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke={color.light ? "#0A0A0A" : "#F0EEE8"}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-[9px] tracking-[0.06em] whitespace-nowrap bg-[var(--foreground)] text-[var(--background)] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                      {color.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedColors.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">Your palette:</span>
                {selectedColors.map((hex) => {
                  const c = COLOR_PALETTE.find((x) => x.hex === hex);
                  return (
                    <span
                      key={hex}
                      className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-2 py-1"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      {c?.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Aesthetic / Style Keywords ── */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
              Your aesthetic
            </p>
            <p className="text-xs text-[var(--foreground-muted)] mb-5">
              Select all that speak to you. GOO will blend your keywords into every recommendation.
            </p>
            <div className="flex flex-wrap gap-2">
              {STYLE_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  onClick={() => toggleStyle(kw)}
                  className={`text-[10px] tracking-[0.12em] uppercase font-medium px-4 py-2 border transition-all duration-200 ${
                    selectedStyles.includes(kw)
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          {/* ── Body Type ── */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Body type
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
              {bodyTypes.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => { setBodyType(bt.id); setSaved(false); }}
                  className={`p-5 text-left transition-colors duration-200 ${
                    bodyType === bt.id
                      ? "bg-[var(--foreground)]"
                      : "bg-[var(--background)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-0.5 ${
                      bodyType === bt.id ? "text-[var(--background)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {bt.label}
                  </p>
                  <p
                    className={`text-xs ${
                      bodyType === bt.id
                        ? "text-[var(--fg-on-dark-60)]"
                        : "text-[var(--foreground-muted)]"
                    }`}
                  >
                    {bt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Sizes ── */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Your sizes
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Tops", placeholder: "XS / S / M / L / XL" },
                { label: "Bottoms", placeholder: "28 / 29 / 30..." },
                { label: "Shoes", placeholder: "EU 38 / UK 5..." },
                { label: "Dresses", placeholder: "34 / 36 / 38..." },
              ].map((field) => (
                <div key={field.label}>
                  <label className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] block mb-2">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    onChange={() => setSaved(false)}
                    className="w-full bg-transparent border border-[var(--border)] text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Budget ── */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Typical outfit budget
            </p>
            <div className="grid grid-cols-2 gap-3">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => { setBudget(b.label); setSaved(false); }}
                  className={`p-4 text-left border transition-all duration-200 ${
                    budget === b.label
                      ? "border-[var(--foreground)] bg-[var(--foreground)]"
                      : "border-[var(--border)] hover:border-[var(--foreground)]"
                  }`}
                >
                  <p className={`text-sm font-medium ${budget === b.label ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                    {b.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${budget === b.label ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                    {b.range}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Appearance ── */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Appearance
            </p>
            <div className="flex items-center justify-between p-5 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-200">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </p>
                <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                  {theme === "dark"
                    ? "Easy on the eyes, GOO's default"
                    : "Optimised for bright environments"}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`relative w-11 h-6 rounded-full transition-colors duration-300 shrink-0 ${
                  theme === "dark" ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${
                    theme === "dark"
                      ? "left-6 bg-[var(--background)]"
                      : "left-1 bg-[var(--background)]"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── Save ── */}
          <div className="flex items-center gap-4 mb-16">
            <button
              onClick={() => setSaved(true)}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
            >
              Save Profile
            </button>
            {saved && (
              <p className="text-xs text-[var(--foreground-muted)] animate-fade-in">
                Profile saved.
              </p>
            )}
          </div>

          {/* ── Saved outfits ── */}
          <div className="border-t border-[var(--border)] pt-10 mb-10">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Saved outfits
            </p>
            <p className="text-sm text-[var(--foreground-muted)]">
              No saved outfits yet.{" "}
              <Link href="/browse" className="text-[var(--foreground)] link-underline">
                Browse the edit
              </Link>{" "}
              to start saving.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
