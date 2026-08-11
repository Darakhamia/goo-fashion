"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Drives a "clamped until you open it" block: whether it is expanded, and
 * whether there is anything still hidden — so the toggle only appears when it
 * would actually do something.
 *
 * Measures only while collapsed. Once expanded scrollHeight === clientHeight,
 * and re-checking then would wrongly report that nothing is left to reveal.
 *
 * Takes the ref rather than returning one: returning it trips
 * react-hooks/refs, which forbids reading a ref during render.
 */
function useClampToggle(ref: RefObject<HTMLElement | null>, content: string) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [ref, expanded, content]);

  return { expanded, setExpanded, overflows };
}

/** Chevron that flips when its block is open. */
function ToggleChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Toggle({
  expanded,
  onToggle,
  label,
  className = "",
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? `Hide full ${label}` : `Show full ${label}`}
      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground-muted)] transition-colors duration-200 ${className}`}
    >
      <ToggleChevron expanded={expanded} />
    </button>
  );
}

/**
 * How many lines a clamped block keeps visible. Spelled out as whole classes
 * because Tailwind only ships the utilities it can see written down.
 */
const CLAMP_CLASS = { 1: "line-clamp-1", 2: "line-clamp-2" } as const;
export type ClampLines = keyof typeof CLAMP_CLASS;

/**
 * A page title clamped with an ellipsis, opened by the chevron beside it.
 * Catalog names carry colour and size, so left alone they run to three lines
 * and push everything below them down the page. Two lines by default; pass
 * `lines={1}` where the panel below the title matters more than the title.
 */
export function ClampedHeading({
  text,
  className = "",
  label = "name",
  lines = 2,
}: {
  text: string;
  className?: string;
  label?: string;
  lines?: ClampLines;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { expanded, setExpanded, overflows } = useClampToggle(ref, text);

  return (
    <div className="flex items-start gap-3">
      <h1
        ref={ref}
        onClick={() => { if (!expanded && overflows) setExpanded(true); }}
        className={`flex-1 min-w-0 ${expanded ? "" : CLAMP_CLASS[lines]} ${
          !expanded && overflows ? "cursor-pointer" : ""
        } ${className}`}
      >
        {text}
      </h1>
      {overflows && (
        <Toggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} label={label} className="mt-2" />
      )}
    </div>
  );
}

/**
 * Body copy with only its first line readable, the rest behind a blur veil
 * until the chevron opens it.
 *
 * At `lines={1}` there is no second line to veil — the one line would end up
 * blurred and unreadable — so that variant ends in an ellipsis instead.
 */
export function ClampedDescription({
  text,
  className = "",
  label = "description",
  lines = 2,
}: {
  text: string;
  className?: string;
  label?: string;
  lines?: ClampLines;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { expanded, setExpanded, overflows } = useClampToggle(ref, text);

  if (!text) return null;

  const veiled = lines === 2;

  return (
    <div className="flex items-start gap-3">
      <div
        className={`relative flex-1 min-w-0 ${!expanded && overflows ? "cursor-pointer" : ""}`}
        onClick={() => { if (!expanded && overflows) setExpanded(true); }}
      >
        <p
          ref={ref}
          className={`text-sm text-[var(--foreground-muted)] leading-[1.6] ${
            expanded ? "" : veiled ? "max-h-[2.8rem] overflow-hidden" : CLAMP_CLASS[lines]
          } ${className}`}
        >
          {text}
        </p>

        {/* Blur veil covering everything past the first line */}
        {veiled && !expanded && overflows && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.4rem] backdrop-blur-[3px] bg-gradient-to-b from-transparent to-[var(--background)]"
          />
        )}
      </div>

      {overflows && (
        <Toggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} label={label} />
      )}
    </div>
  );
}
