"use client";

import { useState, useEffect, useCallback } from "react";

const features = [
  {
    index: "01",
    title: "AI Stylist",
    body: "Tell GOO your occasion, mood, and budget. Receive a complete outfit curated around your profile — every time, instantly.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4v4M14 20v4M4 14H8M20 14h4M7.5 7.5l2.8 2.8M17.7 17.7l2.8 2.8M7.5 20.5l2.8-2.8M17.7 10.3l2.8-2.8" />
        <circle cx="14" cy="14" r="3.5" />
      </svg>
    ),
    items: [
      "Reads your occasion & mood",
      "Builds full look in seconds",
      "Matches your body & budget",
    ],
  },
  {
    index: "02",
    title: "Smart Wardrobe",
    body: "Build your profile once — body type, palette, occasions. The AI refines its picks every session, learning what fits you.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 5a3 3 0 0 0-3 3H8L5 10v2h18v-2l-3-2h-3a3 3 0 0 0-3-3z" />
        <path d="M7 12v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12" />
        <path d="M11 17h6M11 20h4" />
      </svg>
    ),
    items: [
      "Profile set once, improves always",
      "Colour palette & style DNA",
      "Saved brands & outfits",
    ],
  },
  {
    index: "03",
    title: "Best Price",
    body: "Every item is compared across 50+ retailers in real time. You always buy at the lowest available price.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14 14 4l10 10v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />
        <path d="M10 24V16a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v8" />
        <path d="M17 10l-4 4-2-2" />
      </svg>
    ),
    items: [
      "50+ retailers compared live",
      "Lowest price always shown",
      "One click to buy",
    ],
  },
];

export default function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);

  const go = useCallback((idx: number) => {
    if (idx === active || fading) return;
    setFading(true);
    setTimeout(() => {
      setActive(idx);
      setFading(false);
    }, 240);
  }, [active, fading]);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActive((p) => (p + 1) % features.length);
        setFading(false);
      }, 240);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const f = features[active];

  return (
    <div className="flex flex-col gap-8 h-full">

      {/* Card */}
      <div
        className="flex-1 border border-white/8 bg-white/[0.02] flex flex-col justify-between p-10"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.24s ease, transform 0.24s ease",
        }}
      >
        {/* Top */}
        <div className="flex flex-col gap-8">
          {/* Icon + index */}
          <div className="flex items-start justify-between">
            <div className="text-white/30">{f.icon}</div>
            <span className="text-[10px] tracking-[0.22em] uppercase text-white/15">{f.index}</span>
          </div>

          {/* Title */}
          <div>
            <h3
              className="font-display font-light text-white leading-none tracking-tight mb-4"
              style={{
                fontSize: "clamp(2.8rem, 5vw, 4rem)",
                fontFamily: "var(--font-display)",
              }}
            >
              {f.title}
            </h3>
            <p className="text-[13px] text-white/35 leading-relaxed max-w-xs">
              {f.body}
            </p>
          </div>
        </div>

        {/* Bottom — feature list */}
        <div className="flex flex-col gap-0 border-t border-white/6 mt-10">
          {f.items.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-4 py-4 border-b border-white/6"
            >
              <span className="text-[9px] tracking-[0.14em] text-white/15 tabular-nums w-4 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[13px] text-white/55 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-6">
        {features.map((feat, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className="flex items-center gap-3 group"
            aria-label={feat.title}
          >
            <div
              className="h-px transition-all duration-500"
              style={{
                width: i === active ? "36px" : "18px",
                background: i === active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.1)",
              }}
            />
            <span
              className="text-[10px] tracking-[0.16em] uppercase transition-colors duration-300"
              style={{ color: i === active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)" }}
            >
              {feat.title}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}
