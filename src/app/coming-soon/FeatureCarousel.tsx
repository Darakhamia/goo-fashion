"use client";

import { useState, useEffect, useCallback } from "react";

const features = [
  {
    index: "01",
    title: "AI Stylist",
    subtitle: "Your personal stylist, always on.",
    body: "Tell GOO your occasion, mood, and budget. Receive a complete outfit curated around your profile — instantly.",
    tag: "GPT-4o",
    accent: "from-indigo-500/10 to-purple-500/5",
    visual: (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-start">
          <div className="shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center mt-0.5">
            <span className="text-[9px] text-white/50">You</span>
          </div>
          <div className="bg-white/6 border border-white/8 rounded-lg rounded-tl-none px-4 py-3 max-w-[85%]">
            <p className="text-sm text-white/70 leading-relaxed">
              Dinner date, elegant, budget $400
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-start flex-row-reverse">
          <div className="shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
            <span className="text-[9px] text-white/80 font-medium">G</span>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-lg rounded-tr-none px-4 py-3 max-w-[85%]">
            <p className="text-[10px] tracking-[0.14em] uppercase text-white/35 mb-2">GOO suggests</p>
            <div className="flex flex-col gap-1.5">
              {[
                "Cream wool blazer — Toteme",
                "Ivory silk trousers — The Row",
                "Kitten heel mules — Jil Sander",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-white/40 shrink-0" />
                  <span className="text-[12px] text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-1 mt-1">
          <div className="flex-1 h-px bg-white/6" />
          <span className="text-[9px] tracking-[0.14em] uppercase text-white/20">
            total · $387
          </span>
          <div className="flex-1 h-px bg-white/6" />
        </div>
      </div>
    ),
  },
  {
    index: "02",
    title: "Smart Wardrobe",
    subtitle: "Built around you. Better every time.",
    body: "Set your profile once. The AI learns your body, palette, and style — refining every suggestion with each session.",
    tag: "Personalised",
    accent: "from-emerald-500/10 to-teal-500/5",
    visual: (
      <div className="flex flex-col gap-4">
        {/* Style board */}
        <div className="flex gap-2">
          {["#E8E3DC", "#C4B49A", "#8A7968", "#3D3530", "#1A1614"].map((c) => (
            <div
              key={c}
              className="flex-1 h-10 rounded-sm border border-white/8"
              style={{ background: c }}
            />
          ))}
        </div>
        <p className="text-[9px] tracking-[0.16em] uppercase text-white/20">Your palette</p>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          {[
            { label: "Outfits built", value: "34" },
            { label: "Brands saved", value: "12" },
            { label: "Style score", value: "94" },
          ].map((s) => (
            <div key={s.label} className="bg-white/4 border border-white/8 rounded-sm px-3 py-3">
              <p className="text-xl font-light text-white leading-none mb-1">{s.value}</p>
              <p className="text-[9px] tracking-[0.12em] uppercase text-white/25">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    index: "03",
    title: "Best Price",
    subtitle: "50+ retailers. One lowest price.",
    body: "Every item is compared across the web in real time. You always buy at the lowest available price — automatically.",
    tag: "50+ retailers",
    accent: "from-amber-500/10 to-orange-500/5",
    visual: (
      <div className="flex flex-col gap-2">
        <div className="mb-2">
          <p className="text-[9px] tracking-[0.16em] uppercase text-white/25 mb-1">Comparing · Ivory silk trousers</p>
          <div className="h-px bg-white/6" />
        </div>
        {[
          { store: "SSENSE", price: "$340", saving: "Best", pct: 100, best: true },
          { store: "Mytheresa", price: "$365", saving: null, pct: 70, best: false },
          { store: "Net-a-Porter", price: "$378", saving: null, pct: 50, best: false },
          { store: "Farfetch", price: "$390", saving: null, pct: 30, best: false },
        ].map((item) => (
          <div
            key={item.store}
            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all ${
              item.best
                ? "bg-white/10 border border-white/20"
                : "bg-white/[0.03] border border-white/6"
            }`}
          >
            <div
              className="shrink-0 h-1 rounded-full bg-white/20"
              style={{ width: `${item.pct * 0.4}px` }}
            />
            <span className={`flex-1 text-[11px] tracking-wide ${item.best ? "text-white/80" : "text-white/30"}`}>
              {item.store}
            </span>
            {item.best && (
              <span className="text-[8px] tracking-[0.16em] uppercase text-white/50 border border-white/20 px-2 py-0.5 rounded-sm">
                Best
              </span>
            )}
            <span className={`text-sm font-light tabular-nums ${item.best ? "text-white" : "text-white/30"}`}>
              {item.price}
            </span>
          </div>
        ))}
        <p className="text-[9px] tracking-wide text-white/20 mt-1 text-right">
          You save <span className="text-white/50">$50</span> vs avg
        </p>
      </div>
    ),
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
    }, 260);
  }, [active, fading]);

  useEffect(() => {
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % features.length);
        setFading(false);
      }, 260);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const f = features[active];

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* Main card */}
      <div
        className="relative flex-1 overflow-hidden border border-white/8 bg-[#111110]"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(10px)" : "translateY(0)",
          transition: "opacity 0.26s ease, transform 0.26s ease",
        }}
      >
        {/* Gradient accent */}
        <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} pointer-events-none`} />

        {/* Big index watermark */}
        <div
          className="absolute -right-4 -top-6 font-display font-light text-white/[0.04] select-none pointer-events-none leading-none"
          style={{ fontSize: "clamp(7rem, 15vw, 11rem)", fontFamily: "var(--font-display)" }}
          aria-hidden
        >
          {f.index}
        </div>

        <div className="relative z-10 flex flex-col h-full p-8 lg:p-10 gap-8">
          {/* Tag */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/25">{f.index} / 03</span>
            <span className="text-[9px] tracking-[0.14em] uppercase text-white/25 border border-white/10 px-2.5 py-1">
              {f.tag}
            </span>
          </div>

          {/* Title block */}
          <div>
            <h3
              className="font-display font-light text-white leading-[0.9] tracking-tight mb-3"
              style={{
                fontSize: "clamp(2.4rem, 4.5vw, 3.5rem)",
                fontFamily: "var(--font-display)",
              }}
            >
              {f.title}
            </h3>
            <p className="text-[13px] text-white/35 leading-relaxed max-w-sm">
              {f.body}
            </p>
          </div>

          {/* Visual */}
          <div className="mt-auto">{f.visual}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {features.map((feat, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className="flex flex-col gap-1.5 group text-left"
            aria-label={feat.title}
          >
            <div
              className="h-px transition-all duration-500"
              style={{
                width: i === active ? "40px" : "20px",
                background: i === active ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.12)",
              }}
            />
            <span
              className="text-[9px] tracking-[0.14em] uppercase transition-all duration-300"
              style={{ color: i === active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)" }}
            >
              {feat.title}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}
