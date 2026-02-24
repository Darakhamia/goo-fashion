"use client";

import { useState } from "react";
import Link from "next/link";

type BodyType = "slim" | "athletic" | "average" | "curvy" | "petite" | "tall";

const bodyTypes: { id: BodyType; label: string; description: string }[] = [
  { id: "slim", label: "Slim", description: "Lean, long proportions" },
  { id: "athletic", label: "Athletic", description: "Muscular, balanced frame" },
  { id: "average", label: "Average", description: "Balanced proportions" },
  { id: "curvy", label: "Curvy", description: "Defined waist, fuller frame" },
  { id: "petite", label: "Petite", description: "Compact, shorter frame" },
  { id: "tall", label: "Tall", description: "Elongated proportions" },
];

export default function ProfilePage() {
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 max-w-2xl">
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

          {/* Body Type */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Body type
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
              {bodyTypes.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => setBodyType(bt.id)}
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

          {/* Sizes */}
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
                    className="w-full bg-transparent border border-[var(--border)] text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="mb-12">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
              Typical outfit budget
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Entry", range: "$100–400" },
                { label: "Mid", range: "$400–900" },
                { label: "Premium", range: "$900–2000" },
                { label: "Luxury", range: "$2000+" },
              ].map((b) => (
                <button
                  key={b.label}
                  className="p-4 text-left border border-[var(--border)] hover:border-[var(--foreground)] transition-colors duration-200 group"
                >
                  <p className="text-sm font-medium text-[var(--foreground)]">{b.label}</p>
                  <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{b.range}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
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

          {/* Divider */}
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
