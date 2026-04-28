"use client";

import { useState, useEffect } from "react";

const features = [
  {
    index: "01",
    title: "AI Stylist",
    body: "Tell GOO your occasion, mood, and budget. Receive a complete outfit curated around your profile — every time, instantly.",
    tag: "Powered by GPT-4o",
    visual: (
      <div className="flex flex-col gap-2 w-full">
        {["Occasion: dinner date", "Mood: elegant", "Budget: $400"].map((t) => (
          <div key={t} className="flex items-center gap-3 bg-white/5 border border-white/8 px-4 py-3 rounded-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
            <span className="text-[11px] tracking-wide text-white/50">{t}</span>
          </div>
        ))}
        <div className="mt-3 bg-white/[0.07] border border-white/10 px-4 py-3 rounded-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-white/30 mb-1">GOO suggests</p>
          <p className="text-sm text-white/80">Cream blazer · Silk trousers · Leather mules</p>
        </div>
      </div>
    ),
  },
  {
    index: "02",
    title: "Smart Wardrobe",
    body: "Build your profile once — body type, palette, occasions. The AI refines its picks every session, learning what fits you.",
    tag: "Personalised over time",
    visual: (
      <div className="grid grid-cols-3 gap-2 w-full">
        {[
          { label: "Body", value: "Athletic" },
          { label: "Palette", value: "Neutral" },
          { label: "Style", value: "Minimal" },
          { label: "Budget", value: "$200–600" },
          { label: "Brands", value: "12 saved" },
          { label: "Outfits", value: "34 built" },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 border border-white/8 px-3 py-3 rounded-sm flex flex-col gap-1">
            <p className="text-[9px] tracking-[0.16em] uppercase text-white/25">{item.label}</p>
            <p className="text-xs text-white/70">{item.value}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    index: "03",
    title: "Best Price",
    body: "Every item is compared across 50+ retailers in real time. You always buy at the lowest available price.",
    tag: "50+ retailers compared",
    visual: (
      <div className="flex flex-col gap-2 w-full">
        {[
          { store: "SSENSE", price: "$340", best: true },
          { store: "Mytheresa", price: "$365", best: false },
          { store: "Net-a-Porter", price: "$390", best: false },
        ].map((item) => (
          <div
            key={item.store}
            className={`flex items-center justify-between px-4 py-3 rounded-sm border ${
              item.best
                ? "bg-white/10 border-white/20"
                : "bg-white/[0.03] border-white/6"
            }`}
          >
            <div className="flex items-center gap-3">
              {item.best && (
                <span className="text-[9px] tracking-[0.14em] uppercase text-white/40 border border-white/20 px-2 py-0.5 rounded-sm">
                  Best
                </span>
              )}
              <span className={`text-[11px] tracking-wide ${item.best ? "text-white/80" : "text-white/35"}`}>
                {item.store}
              </span>
            </div>
            <span className={`text-sm font-light ${item.best ? "text-white" : "text-white/35"}`}>
              {item.price}
            </span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);

  const go = (idx: number) => {
    if (idx === active || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setActive(idx);
      setAnimating(false);
    }, 220);
  };

  // Auto-advance
  useEffect(() => {
    const id = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % features.length);
        setAnimating(false);
      }, 220);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const f = features[active];

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Card */}
      <div
        className="flex-1 flex flex-col justify-between border border-white/10 bg-white/[0.03] p-8 rounded-sm"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.22s ease, transform 0.22s ease",
        }}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] tracking-[0.22em] uppercase text-white/25">{f.index}</span>
            <span className="text-[9px] tracking-[0.16em] uppercase text-white/25 border border-white/10 px-2.5 py-1 rounded-sm">
              {f.tag}
            </span>
          </div>
          <h3
            className="text-2xl font-light text-white mb-3 leading-snug"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {f.title}
          </h3>
          <p className="text-[13px] text-white/40 leading-relaxed mb-8">{f.body}</p>
        </div>

        {/* Visual */}
        <div>{f.visual}</div>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-2 mt-5">
        {features.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className="group flex items-center"
            aria-label={`Go to feature ${i + 1}`}
          >
            <div
              className="h-px rounded-full transition-all duration-300"
              style={{
                width: i === active ? "32px" : "16px",
                background: i === active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
              }}
            />
          </button>
        ))}
        <span className="ml-auto text-[10px] tracking-[0.16em] text-white/20">
          {active + 1} / {features.length}
        </span>
      </div>
    </div>
  );
}
