"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────── */

function EmailForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (state === "loading" || state === "done") return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  };

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 px-6 py-5 sm:px-8 sm:py-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        boxShadow: "0 0 40px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="shrink-0">
        <p className="text-[8px] tracking-[0.28em] uppercase text-white/30 mb-1.5">Be the first to know</p>
        <p className="text-[15px] sm:text-[17px] font-black text-white uppercase tracking-tight leading-tight">
          Get notified when<br className="hidden sm:block" /> we launch.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="flex-1 flex items-center"
        style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "rgba(0,0,0,0.5)", overflow: "hidden" }}
      >
        {state === "done" ? (
          <p className="flex-1 px-5 py-3.5 text-[11px] text-white/45 tracking-[0.14em] uppercase">You&apos;re on the list ✓</p>
        ) : (
          <>
            <input
              type="email" value={email}
              onChange={(e: { target: { value: string } }) => setEmail(e.target.value)}
              placeholder="ENTER YOUR EMAIL" required
              className="flex-1 bg-transparent px-5 py-3.5 text-[11px] text-white placeholder:text-white/20 tracking-[0.1em] outline-none"
            />
            <button type="submit" disabled={state === "loading"}
              className="px-5 py-3.5 text-white/40 hover:text-white transition-colors disabled:opacity-30 shrink-0">
              {state === "loading" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="5" strokeOpacity="0.2"/><path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8h12M9 3.5l5 4.5-5 4.5"/>
                </svg>
              )}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/* ── Floating panel card ───────────────────────────────── */
interface FloatCardProps {
  n: string;
  label: string;
  pos: React.CSSProperties;   // outer: left/top/width/height/transform/zIndex
  drift: number;              // 0 | 1 | 2
  children?: React.ReactNode;
}

function FloatCard({ n, label, pos, drift, children }: FloatCardProps) {
  const durationMap = [7, 8.5, 6.5];
  const delayMap    = [0, 1.8, 0.9];
  return (
    <div style={{ position: "absolute", ...pos }}>
      {/* drift wrapper — only translateY, no conflict with outer 3-D transform */}
      <div style={{
        width: "100%", height: "100%",
        animation: `gDrift${drift} ${durationMap[drift]}s ${delayMap[drift]}s ease-in-out infinite`,
      }}>
        {/* card surface */}
        <div style={{
          width: "100%", height: "100%", position: "relative",
          borderRadius: 14, overflow: "hidden",
          background: "rgba(9,9,9,0.97)",
          border: "1px solid rgba(255,255,255,0.075)",
          boxShadow: [
            "inset 0 1px 0 rgba(255,255,255,0.055)",
            "0 0 0 0.5px rgba(255,255,255,0.03)",
          ].join(", "),
        }}>

          {/* glass diagonal sheen */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none",
            background: "linear-gradient(140deg, rgba(255,255,255,0.028) 0%, transparent 40%)",
          }}/>

          {/* top-edge highlight */}
          <div aria-hidden style={{
            position: "absolute", top: 0, left: "20%", right: "20%",
            height: 1, zIndex: 6, pointerEvents: "none",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
          }}/>

          {/* category label */}
          <div style={{
            position: "absolute", top: 11, left: 13, zIndex: 10,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 7, fontFamily: "monospace", color: "rgba(255,255,255,0.22)", letterSpacing: "0.22em" }}>{n}</span>
            <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.12)" }}/>
            <span style={{ fontSize: 7, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.24em", textTransform: "uppercase" }}>{label}</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────── */
export default function FeatureCarousel({ onSlideChange: _ }: { onSlideChange?: (idx: number) => void }) {
  return (
    <>
      <style>{`
        /* drift keyframes — only Y movement so they don't conflict with 3-D transforms */
        @keyframes gDrift0 { 0%,100%{transform:translateY(0px)}   50%{transform:translateY(-7px)}  }
        @keyframes gDrift1 { 0%,100%{transform:translateY(-4px)}  50%{transform:translateY(6px)}   }
        @keyframes gDrift2 { 0%,100%{transform:translateY(3px)}   50%{transform:translateY(-8px)}  }
        @keyframes csReveal { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div className="h-full flex flex-col" style={{ gap: 12 }}>

        {/* ───────────────────────────────────────────────── */}
        {/* CINEMATIC COMPOSITION                            */}
        {/* ───────────────────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 relative overflow-hidden"
          style={{ perspective: "900px" }}
        >
          {/* ── multi-edge vignette ── */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none",
            background: "linear-gradient(to right, #080808 0%, transparent 13%, transparent 70%, #080808 100%)",
          }}/>
          <div aria-hidden style={{
            position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none",
            background: "linear-gradient(to bottom, #080808 0%, transparent 9%, transparent 60%, #080808 100%)",
          }}/>

          {/* ── 3-D scene ── */}
          <div
            style={{
              position: "absolute", inset: 0,
              transform: "rotateX(4deg) rotateY(-11deg)",
              transformOrigin: "center 38%",
              transformStyle: "preserve-3d",
              animation: "csReveal 0.9s cubic-bezier(0.16,1,0.3,1) both 0.3s",
            }}
          >

            {/* ── Card 1: ITEMS — hero, large, front ── */}
            <FloatCard n="01" label="ITEMS" drift={0} pos={{
              left: "3%", top: "7%", width: "44%", height: "73%",
              transform: "translateZ(60px) rotateZ(-1.5deg)",
              zIndex: 4,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/cs/hoodie.png" alt="Items"
                style={{
                  position: "absolute",
                  top: 28, bottom: 42, left: 0, right: 0,
                  width: "100%", height: "calc(100% - 28px - 42px)",
                  objectFit: "contain", objectPosition: "center",
                  filter: "grayscale(1) contrast(1.12)",
                  padding: "10px 18px",
                }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "10px 13px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}>
                <p style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.8)", letterSpacing: "0.08em", textTransform: "uppercase" }}>HOODIE</p>
                <p style={{ fontSize: 7, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>ENFANTS RICHES DÉPRIMÉS</p>
              </div>
            </FloatCard>

            {/* ── Card 2: OUTFITS — medium, mid-depth ── */}
            <FloatCard n="02" label="OUTFITS" drift={1} pos={{
              left: "27%", top: "1%", width: "39%", height: "61%",
              transform: "translateZ(20px) rotateZ(-0.5deg)",
              zIndex: 3,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/cs/jeans.png" alt="Outfits"
                style={{
                  position: "absolute",
                  top: 28, bottom: 40, left: 0, right: 0,
                  width: "100%", height: "calc(100% - 28px - 40px)",
                  objectFit: "contain", objectPosition: "center",
                  filter: "grayscale(1) contrast(1.1)",
                  padding: "8px 16px",
                }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "9px 13px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.72)", letterSpacing: "0.08em", textTransform: "uppercase" }}>JEANS</p>
                <p style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>STRIPE BAGGY DENIM</p>
              </div>
            </FloatCard>

            {/* ── Card 3: BRANDS — right, partially cropped, back ── */}
            <FloatCard n="03" label="BRANDS" drift={2} pos={{
              right: "-4%", top: "17%", width: "37%", height: "54%",
              transform: "translateZ(-25px) rotateZ(1deg)",
              zIndex: 2,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/cs/sneakers.png" alt="Brands"
                style={{
                  position: "absolute",
                  top: 28, bottom: 40, left: 0, right: 0,
                  width: "100%", height: "calc(100% - 28px - 40px)",
                  objectFit: "contain", objectPosition: "center",
                  filter: "grayscale(1) contrast(1.05)",
                  padding: "8px 14px",
                }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "9px 13px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>SNEAKERS</p>
                <p style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>BALENCIAGA</p>
              </div>
            </FloatCard>

            {/* ── Card 4: AI STYLIST — thin accent, top-right ── */}
            <FloatCard n="04" label="AI STYLIST" drift={1} pos={{
              right: "5%", top: "1%", width: "29%", height: "16%",
              transform: "translateZ(5px) rotateZ(0.8deg)",
              zIndex: 3,
            }}>
              <div style={{ position: "absolute", bottom: 10, left: 13, right: 13 }}>
                <p style={{ fontSize: 8, color: "rgba(255,255,255,0.32)", letterSpacing: "0.07em", textTransform: "uppercase", lineHeight: 1.55 }}>
                  Your personal<br/>stylist. On demand.
                </p>
              </div>
            </FloatCard>

            {/* ── Card 5: SMART WARDROBE — small bottom accent ── */}
            <FloatCard n="05" label="SMART WARDROBE" drift={0} pos={{
              left: "46%", top: "75%", width: "27%", height: "16%",
              transform: "translateZ(-10px) rotateZ(-0.8deg)",
              zIndex: 2,
            }}>
              <div style={{ position: "absolute", bottom: 9, left: 13, right: 13 }}>
                <p style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.55 }}>
                  Intelligently<br/>curated.
                </p>
              </div>
            </FloatCard>

          </div>
        </div>

        {/* ── Email form ── */}
        <div className="shrink-0">
          <EmailForm />
        </div>

        {/* ── Bottom tagline ── */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}
        >
          <div className="flex items-center gap-5">
            {["AI STYLIST", "SMART WARDROBE", "BEST PRICE"].map(t => (
              <span key={t} style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em", textTransform: "uppercase" }}>{t}</span>
            ))}
          </div>
          <p style={{ fontSize: 7, color: "rgba(255,255,255,0.1)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            AI · FASHION · STYLE
          </p>
        </div>

      </div>
    </>
  );
}
