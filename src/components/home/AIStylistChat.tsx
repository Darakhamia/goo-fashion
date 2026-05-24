"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

type Msg = { role: "ai" | "user"; text: string };

const CONV: Msg[] = [
  { role: "ai",   text: "Hey! Tell me the occasion, style and budget — I'll build the outfit." },
  { role: "user", text: "Gallery opening. Black & cream, minimal. Under $600." },
  { role: "ai",   text: "Perfect. Longline matte-black wool coat with cream wide-leg trousers." },
  { role: "user", text: "What shoes and accessories?" },
  { role: "ai",   text: "Square-toe leather mules, oval metal sunglasses. Total: ~$580." },
];

// count = visible messages, typing = who's typing next, wait = ms before advancing
const STEPS: { count: number; typing: "ai" | "user" | null; wait: number }[] = [
  { count: 0, typing: "ai",   wait: 900  },
  { count: 1, typing: null,   wait: 500  },
  { count: 1, typing: "user", wait: 850  },
  { count: 2, typing: null,   wait: 500  },
  { count: 2, typing: "ai",   wait: 1100 },
  { count: 3, typing: null,   wait: 500  },
  { count: 3, typing: "user", wait: 750  },
  { count: 4, typing: null,   wait: 500  },
  { count: 4, typing: "ai",   wait: 1000 },
  { count: 5, typing: null,   wait: 2600 },
  { count: 0, typing: null,   wait: 650  }, // clear — all messages fade out
];

export function AIStylistChat() {
  const [stepIdx, setStepIdx] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const step = STEPS[stepIdx];
    timeoutRef.current = setTimeout(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, step.wait);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [stepIdx]);

  const step = STEPS[stepIdx];
  const messages = CONV.slice(0, step.count);

  return (
    <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--background)] text-sm font-bold">
            G
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[var(--surface)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">AI Stylist</p>
          <p className="text-[12px] text-[var(--foreground-muted)]">Online · ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="px-6 py-5 h-[280px] flex flex-col justify-end gap-3 overflow-hidden">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-4 py-3 rounded-2xl text-[13px] max-w-[82%] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--foreground)] text-[var(--background)] rounded-tr-sm"
                    : "bg-[var(--background)] text-[var(--foreground)] rounded-tl-sm"
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {step.typing && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.22 }}
              className={`flex ${step.typing === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-4 py-3.5 rounded-2xl flex items-center gap-[5px] ${
                  step.typing === "user"
                    ? "bg-[var(--foreground)] rounded-tr-sm"
                    : "bg-[var(--background)] rounded-tl-sm"
                }`}
              >
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className={`w-[6px] h-[6px] rounded-full ${
                      step.typing === "user"
                        ? "bg-[var(--background)]/50"
                        : "bg-[var(--foreground-muted)]"
                    }`}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.1,
                      repeat: Infinity,
                      delay: dot * 0.18,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div className="px-6 pb-6">
        <div className="h-11 border border-[var(--border)] rounded-full px-4 flex items-center justify-between bg-[var(--background)]">
          <span className="text-[13px] text-[var(--foreground-subtle)]">Message AI Stylist…</span>
          <span className="text-[11px] text-[var(--foreground-subtle)]">⏎</span>
        </div>
      </div>
    </div>
  );
}
