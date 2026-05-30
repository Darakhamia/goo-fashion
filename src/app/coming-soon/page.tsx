"use client";

import { useState } from "react";
import FeatureCarousel from "./FeatureCarousel";

const FEATURES = [
  { icon: "/cs/icon-stylist.png", title: "AI STYLIST",  body: "Your personal stylist. On demand." },
  { icon: "/cs/icon-price.png",   title: "BEST PRICE",  body: "Scanned across 50+ retailers."    },
  { icon: "/cs/icon-click.png",   title: "ONE CLICK",   body: "Buy the whole fit. Instantly."    },
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
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes dotPulse {
          0%,100% { opacity:0.4; transform:scale(1);    }
          50%      { opacity:1;   transform:scale(1.4); }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 md:px-12 lg:px-16 pt-8 shrink-0">
        <span className="text-[13px] tracking-[0.34em] uppercase font-black text-white"
          style={{ letterSpacing: "0.3em" }}>GOO</span>
        <div className="flex items-center gap-3" style={{ animation: "fadeIn 0.6s ease both 0.5s" }}>
          <span className="text-[11px] tracking-[0.2em] text-white/25 font-mono tabular-nums">
            {String(slideIdx + 1).padStart(2, "0")}
          </span>
          <div className="h-px w-8 bg-white/20" />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 px-8 md:px-12 lg:px-0 pb-6 lg:pb-0">

        {/* ── LEFT PANEL ── */}
        <div className="lg:w-[40%] xl:w-[38%] flex flex-col justify-between lg:px-14 xl:px-16 lg:py-8 shrink-0">
          <div className="flex flex-col mt-5 lg:mt-0">

            {/* Launching label */}
            <div className="flex items-center gap-2 mb-5"
              style={{ animation: "fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both 0.1s" }}>
              <p className="text-[9px] tracking-[0.3em] uppercase font-medium text-white/28">Launching 2026</p>
              <span className="w-1.5 h-1.5 rounded-full bg-white/30"
                style={{ animation: "dotPulse 2.4s ease-in-out infinite" }}/>
            </div>

            {/* Headline */}
            <h1
              className="font-black text-white uppercase leading-[0.86] mb-5"
              style={{
                fontSize: "clamp(2.8rem, 5.8vw, 6rem)",
                letterSpacing: "-0.02em",
                animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both 0.18s",
              }}
            >
              Built<br />Different.<br />Made to<br />Fit.
            </h1>

            {/* Subtitle */}
            <p
              className="text-[10px] leading-relaxed uppercase mb-7"
              style={{
                color: "rgba(255,255,255,0.32)",
                letterSpacing: "0.07em",
                maxWidth: 270,
                animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both 0.28s",
              }}
            >
              AI builds complete outfits around your style,
              body, and budget. Premium brands.
              Best price. No bullshit.
            </p>

            {/* Feature rows */}
            <div style={{ animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both 0.36s" }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="flex items-center gap-4 py-3.5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {/* Icon — glowing square image */}
                  <div className="shrink-0" style={{ width: 42, height: 42 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.icon}
                      alt={f.title}
                      className="w-full h-full object-contain"
                      style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.25))" }}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white tracking-[0.1em] uppercase leading-tight"
                      style={{ textShadow: i === 0 ? "0 0 12px rgba(255,255,255,0.2)" : "none" }}>
                      {f.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 lg:mt-0 shrink-0"
            style={{ animation: "fadeIn 0.8s ease both 0.7s" }}>
            <p className="text-[8px] tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.14)" }}>
              © 2026 GOO
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="flex-1 flex flex-col min-h-0 mt-6 lg:mt-0 lg:pl-12 xl:pl-14 lg:py-8"
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.05)",
            animation: "fadeIn 0.7s ease both 0.25s",
          }}
        >
          <FeatureCarousel onSlideChange={setSlideIdx} />
        </div>
      </div>
    </main>
  );
}
