// The AI stylist, from src/components/stylist/StylistDrawer.tsx (:667-1040),
// in its phone styles (the max-md branch): 15 px bubbles, 84 px product tiles
// and the "Build this look" row card. On desktop the same drawer draws 12 px
// bubbles and a small outline pill instead, which no one could read in a card
// 800 px wide. Messages, typing and the reveal come from the scene.
import React from "react";
import { Img } from "remotion";
import type { Product } from "@/lib/types";
import { formatPrice } from "../../shims/currency-context";

export type ThreadState = {
  /** Text in the composer. */
  input: string;
  /** 0–1: the field's focus border. */
  focus: number;
  /** Send button pressed (0–1). */
  sendPress: number;
  user: number;
  typing: number;
  /** Seconds, for the bouncing dots. */
  seconds: number;
  reply: number;
  /** Words of the reply shown so far. */
  replyWords: number;
  tiles: [number, number];
  card: number;
  /** How far the thread has scrolled to keep the newest message in view. */
  scroll: number;
};

function bounce(seconds: number, delayMs: number) {
  // Tailwind's animate-bounce: 1 s, translateY(-25%) at 0/100%, 0 at 50%.
  const t = (((seconds - delayMs / 1000) % 1) + 1) % 1;
  const u = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
  return -25 * (1 - u * u);
}

export function StylistSheet({
  width,
  height,
  greeting,
  question,
  reply,
  suggestions,
  quickReplies,
  st,
}: {
  width: number;
  height: number;
  greeting: string;
  question: string;
  reply: string;
  suggestions: Product[];
  quickReplies: string[];
  st: ThreadState;
}) {
  const words = reply.split(" ");
  const shown = words.slice(0, Math.max(0, Math.round(st.replyWords))).join(" ");
  const pop = (v: number, dy = 10): React.CSSProperties => ({
    opacity: v,
    transform: `translateY(${(1 - v) * dy}px) scale(${0.96 + 0.04 * v})`,
  });
  return (
    <div
      role="dialog"
      aria-label="AI Stylist chat"
      className="bg-[var(--surface)] flex flex-col rounded-[28px] overflow-hidden"
      style={{ width, height, boxShadow: "0 30px 90px rgba(0,0,0,0.6), 0 0 0 1px var(--border)" }}
    >
      <div className="flex justify-center pt-2 shrink-0">
        <div className="w-9 h-1 rounded-full bg-[var(--border-strong)]" />
      </div>
      <div className="pl-4 pr-1.5 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[14px] font-bold">G</div>
          <div>
            <p className="text-[16px] font-semibold text-[var(--foreground)]">Stylist</p>
            <p className="text-[12px] text-[var(--foreground-muted)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <span className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--foreground-muted)]">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
              <path d="M11 1l2 2-5 5H6V6l5-5Z" />
            </svg>
          </span>
          <span className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--foreground-muted)]">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5.5" />
              <path d="M7 4.5V7l1.5 1.5" />
            </svg>
          </span>
          <span className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--foreground-muted)]">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className="px-4 pt-3 pb-4 flex flex-col gap-2.5" style={{ transform: `translateY(${-st.scroll}px)` }}>
          <div className="flex flex-col gap-2 items-start">
            <div className="max-w-[88%] px-3.5 py-[11px] text-[15px] leading-[1.4] border-0 bg-[var(--fg-overlay-08)] text-[var(--foreground)] rounded-[18px] rounded-bl-md">
              {greeting}
            </div>
          </div>
          {st.user > 0 && (
            <div className="flex flex-col gap-2 items-end" style={pop(st.user)}>
              <div className="max-w-[88%] px-3.5 py-[11px] text-[15px] leading-[1.4] border-0 bg-[var(--foreground)] text-[var(--background)] rounded-[18px] rounded-br-md">
                {question}
              </div>
            </div>
          )}
          {st.typing > 0 && st.reply <= 0 && (
            <div className="flex items-start" style={{ opacity: st.typing }}>
              <div className="bg-[var(--fg-overlay-08)] rounded-[18px] rounded-bl-md px-4 py-3.5 flex items-center gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--foreground-muted)]"
                    style={{ transform: `translateY(${bounce(st.seconds, delay)}%)` }}
                  />
                ))}
              </div>
            </div>
          )}
          {st.reply > 0 && (
            <div className="flex flex-col gap-2 items-start" style={pop(st.reply, 6)}>
              <div className="max-w-[88%] px-3.5 py-[11px] text-[15px] leading-[1.4] border-0 bg-[var(--fg-overlay-08)] text-[var(--foreground)] rounded-[18px] rounded-bl-md">
                {/* The full reply sets the bubble's size; the words appear inside it. */}
                <span style={{ position: "relative", display: "block" }}>
                  <span style={{ visibility: "hidden" }}>{reply}</span>
                  <span style={{ position: "absolute", inset: 0 }}>{shown}</span>
                </span>
              </div>
              <div className="w-full flex flex-col gap-2">
                <div className="flex gap-2 pb-1">
                  {suggestions.map((product, i) => (
                    <div key={product.id} className="shrink-0 flex flex-col w-[84px]" style={pop(st.tiles[i] ?? 0, 14)}>
                      <div
                        className="w-full aspect-[3/4] overflow-hidden bg-[var(--surface)] relative rounded-2xl"
                        data-match={i === suggestions.length - 1 ? "from" : undefined}
                      >
                        <Img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[12px] text-[var(--foreground-muted)] mt-1.5 truncate w-full text-left leading-none">{product.brand}</p>
                      <p className="text-[13px] text-[var(--foreground)] truncate w-full text-left leading-tight mt-0.5">
                        {formatPrice(product.priceMin)}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  className="w-full max-w-[300px] h-[72px] rounded-2xl bg-[var(--fg-overlay-08)] flex items-center gap-3 pl-2 pr-3 text-[var(--foreground)]"
                  style={pop(st.card, 16)}
                >
                  <span className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-[var(--surface)]">
                    <Img src={suggestions[0].imageUrl} alt="" className="w-full h-full object-cover" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold">Build this look</span>
                    <span className="block mt-0.5 text-[12px] text-[var(--foreground-muted)] truncate">
                      {suggestions.length} pieces · Opens in the builder
                    </span>
                  </span>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--foreground-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick-reply chips */}
      <div className="px-4 pt-1 pb-2.5 shrink-0 flex gap-2 overflow-hidden">
        {quickReplies.map((r) => (
          <span key={r} className="relative shrink-0 h-9 px-3.5 rounded-full bg-[var(--fg-overlay-08)] text-[13px] text-[var(--foreground)] whitespace-nowrap flex items-center">
            {r}
          </span>
        ))}
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 shrink-0">
        <div
          className="flex items-center gap-2 h-[50px] rounded-full border pl-[18px] pr-1.5 bg-[var(--fg-overlay-08)]"
          style={{ borderColor: st.focus > 0 ? `rgba(240,238,232,${st.focus})` : "transparent" }}
        >
          <span className="flex-1 min-w-0 h-8 flex items-center text-base whitespace-nowrap overflow-hidden">
            {st.input ? (
              <span className="text-[var(--foreground)]">{st.input}</span>
            ) : (
              <span className="text-[var(--foreground-subtle)]">Ask your stylist…</span>
            )}
          </span>
          <span
            className="relative w-[38px] h-[38px] rounded-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] shrink-0"
            style={{ opacity: st.input.trim() ? 1 : 0.3, transform: `scale(${1 - st.sendPress * 0.1})` }}
          >
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
