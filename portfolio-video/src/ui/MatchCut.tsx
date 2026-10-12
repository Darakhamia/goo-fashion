// The match cut from the stylist's sneaker tile to the product page's photo.
// Both ends are found in the DOM ([data-match="from"|"to"]) and the flying copy
// is placed in a layout effect, so it lands exactly on the real elements in
// both cuts without hand-measured numbers.
import React, { useLayoutEffect, useRef } from "react";
import { Img, useCurrentFrame } from "remotion";
import { easeInOut, ramp } from "../motion";

export function MatchCut({ src, start, end }: { src: string; start: number; end: number }) {
  const f = useCurrentFrame();
  const ref = useRef<HTMLDivElement>(null);
  const active = f >= start && f <= end;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.parentElement;
    const from = root?.querySelector('[data-match="from"]');
    const to = root?.querySelector('[data-match="to"]');
    if (!active || !root || !from || !to) {
      el.style.display = "none";
      return;
    }
    const rr = root.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const t = easeInOut(ramp(f, start, end, (v) => v));
    const lerp = (p: number, q: number) => p + (q - p) * t;
    el.style.display = "block";
    el.style.left = `${lerp(a.left, b.left) - rr.left}px`;
    el.style.top = `${lerp(a.top, b.top) - rr.top}px`;
    el.style.width = `${lerp(a.width, b.width)}px`;
    el.style.height = `${lerp(a.height, b.height)}px`;
    el.style.borderRadius = `${lerp(16 * (a.width / 84), 16 * (b.width / 380))}px`;
    el.style.opacity = `${Math.min(1, ramp(f, start, start + 3) * (1 - ramp(f, end - 2, end)))}`;
  });
  return (
    <div ref={ref} style={{ position: "absolute", display: "none", overflow: "hidden", background: "#fff", zIndex: 50 }}>
      <Img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
}
