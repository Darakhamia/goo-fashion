"use client";

import { useState } from "react";
import FeatureCarousel from "./FeatureCarousel";

const FEATURES = [
  {
    icon: "/cs/icon-stylist.png",
    title: "AI STYLIST",
    body: "Your personal stylist. On demand.",
  },
  {
    icon: "/cs/icon-price.png",
    title: "BEST PRICE",
    body: "Scanned across 50+ retailers.",
  },
  {
    icon: "/cs/icon-click.png",
    title: "ONE CLICK",
    body: "Buy the whole fit. Instantly.",
  },
];

export default function ComingSoonPage() {
  const [slideIdx, setSlideIdx] = useState(0);

  return (
    <main className="min-h-screen h-screen bg-[#080808] flex flex-col overflow-hidden" style={{ fontFamily: "var(--font-poppins), sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 md:px-12 lg:px-16 pt-8 shrink-0">
        <span className="text-[12px] tracking-[0.32em] uppercase font-bold text-white">GOO</span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tracking-[0.22em] text-white/25 font-mono tabular-nums">
            {String(slideIdx + 1).padStart(2, "0")}
          </span>
          <div className="w-8 h-px bg-white/20" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 px-8 md:px-12 lg:px-0 pb-8 lg:pb-0">

        {/* ── LEFT PANEL ── */}
        <div className="lg:w-[42%] flex flex-col justify-between lg:px-16 lg:py-10 shrink-0">
          <div className="flex flex-col">
            {/* Launching label */}
            <div className="flex items-center gap-2 mb-6 mt-6 lg:mt-0"
              style={{ animation: "fadeUp 0.6s ease both 0.1s" }}>
              <p className="text-[10px] tracking-[0.26em] uppercase font-medium text-white/30">Launching 2026</p>
              <span className="w-1 h-1 rounded-full bg-white/30" />
            </div>

            {/* Headline */}
            <h1
              className="font-black text-white uppercase leading-[0.88] tracking-[-0.02em] mb-6"
              style={{
                fontSize: "clamp(3rem, 6.5vw, 6.5rem)",
                animation: "fadeUp 0.7s ease both 0.2s",
              }}
            >
              Built<br />Different.<br />Made to<br />Fit.
            </h1>

            {/* Subtitle */}
            <p
              className="text-[11px] text-white/35 leading-relaxed max-w-[280px] uppercase tracking-[0.06em] mb-8"
              style={{ animation: "fadeUp 0.7s ease both 0.35s" }}
            >
              AI builds complete outfits around your style, body, and budget. Premium brands.
              Best price. No bullshit.
            </p>

            {/* Features */}
            <div className="flex flex-col gap-0" style={{ animation: "fadeUp 0.7s ease both 0.45s" }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 py-4 border-t border-white/[0.06]"
                  style={{ animationDelay: `${0.5 + i * 0.08}s` }}
                >
                  <div className="w-10 h-10 shrink-0 mt-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.icon} alt={f.title} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white tracking-[0.1em] uppercase leading-tight">{f.title}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">{f.body}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-white/[0.06]" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8 lg:mt-0 shrink-0">
            <p className="text-[9px] tracking-[0.16em] uppercase text-white/15">© 2026 GOO</p>
            <p className="text-[9px] tracking-[0.12em] uppercase text-white/15">AI · Fashion · Personal Style</p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="flex-1 border-l border-white/[0.05] lg:px-12 lg:py-10 flex flex-col min-h-0 mt-8 lg:mt-0"
          style={{ animation: "fadeIn 0.8s ease both 0.3s" }}
        >
          <FeatureCarousel onSlideChange={setSlideIdx} />
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </main>
  );
}
