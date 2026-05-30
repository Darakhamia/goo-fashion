"use client";

import { useState } from "react";
import FeatureCarousel from "./FeatureCarousel";

const FEATURES = [
  {
    svg: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round">
        <path d="M11 2v2.5M11 17.5V20M2 11h2.5M17.5 11H20M4.4 4.4l1.77 1.77M15.83 15.83l1.77 1.77M15.83 6.17l1.77-1.77M4.4 17.6l1.77-1.77"/>
        <circle cx="11" cy="11" r="3"/>
      </svg>
    ),
    title: "AI STYLIST",
    body: "Your personal stylist. On demand.",
  },
  {
    svg: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/>
        <circle cx="11" cy="11" r="3"/>
        <path d="M11 3v2M11 17v2M3 11h2M17 11h2"/>
      </svg>
    ),
    title: "BEST PRICE",
    body: "Scanned across 50+ retailers.",
  },
  {
    svg: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2.5L13.5 9H20L14.5 12.8L16.5 19L11 15.2L5.5 19L7.5 12.8L2 9H8.5L11 2.5Z"/>
      </svg>
    ),
    title: "ONE CLICK",
    body: "Buy the whole fit. Instantly.",
  },
];

export default function ComingSoonPage() {
  const [slideIdx, setSlideIdx] = useState(0);

  return (
    <main
      className="min-h-screen h-screen flex flex-col overflow-hidden"
      style={{ background: "#080808", fontFamily: "var(--font-poppins), sans-serif" }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes dotPulse {
          0%,100% { opacity:0.35; transform:scale(1);   }
          50%      { opacity:1;   transform:scale(1.5); }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 md:px-10 pt-7 shrink-0">
        <span className="text-[13px] tracking-[0.34em] uppercase font-black text-white">GOO</span>
        <div className="flex items-center gap-3" style={{ animation: "fadeIn 0.6s ease both 0.5s" }}>
          <span className="text-[11px] tracking-[0.2em] text-white/25 font-mono tabular-nums">
            {String(slideIdx + 1).padStart(2, "0")}
          </span>
          <div className="h-px w-7 bg-white/20" />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 pb-5 lg:pb-0 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <div className="lg:w-[34%] xl:w-[32%] flex flex-col justify-between px-8 md:px-10 lg:py-7 shrink-0 mt-4 lg:mt-0">
          <div className="flex flex-col">

            {/* Launching */}
            <div className="flex items-center gap-2 mb-4"
              style={{ animation: "fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both 0.1s" }}>
              <p className="text-[9px] tracking-[0.3em] uppercase font-medium text-white/28">Launching 2026</p>
              <span className="w-1.5 h-1.5 rounded-full bg-white/35"
                style={{ animation: "dotPulse 2.5s ease-in-out infinite" }}/>
            </div>

            {/* Headline */}
            <h1
              className="font-black text-white uppercase mb-4"
              style={{
                fontSize: "clamp(2.4rem, 4.8vw, 5.2rem)",
                lineHeight: 0.88,
                letterSpacing: "-0.025em",
                animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both 0.18s",
              }}
            >
              Built<br />Different.<br />Made to<br />Fit.
            </h1>

            {/* Subtitle */}
            <p
              className="text-[10px] leading-relaxed uppercase mb-6"
              style={{
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.06em",
                maxWidth: 240,
                animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both 0.26s",
              }}
            >
              AI builds complete outfits around your style,
              body, and budget. Premium brands.
              Best price. No bullshit.
            </p>

            {/* Feature rows */}
            <div style={{ animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both 0.34s" }}>
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex items-center gap-3.5 py-3.5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {/* Icon box with glow */}
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 0 18px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    {f.svg}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white tracking-[0.1em] uppercase leading-tight">
                      {f.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 lg:mt-0 shrink-0"
            style={{ animation: "fadeIn 0.8s ease both 0.7s" }}>
            <p className="text-[8px] tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.13)" }}>
              © 2026 GOO
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="flex-1 flex flex-col min-h-0 px-8 md:px-0 lg:pl-8 xl:pl-10 lg:pr-8 xl:pr-10 lg:py-7 mt-5 lg:mt-0 overflow-hidden"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.055)",
            animation: "fadeIn 0.7s ease both 0.22s",
          }}
        >
          <FeatureCarousel onSlideChange={setSlideIdx} />
        </div>
      </div>
    </main>
  );
}
