// Beat 2: the catalogue. The real browse grid (public/captures/catalogue.png:
// the first 16 cards of the live catalogue, in the site's own order) lies on a
// plane tilted in 3D. Each card's photo, cropped from that capture, flies in
// from outside the frame and lands in its slot; then the cards' frames, names
// and prices (catalogue-frames.png, the same grid with its photos hidden) fade
// in around them, and the grid is the capture itself. The plane straightens as
// the camera pushes in.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, mix, ramp, settle } from "../../motion";
import { M, PAPER, Shot, rand, type Format, SIZE } from "../kit";

const C = M.catalogue;
const SIZE_CSS = C.size; // 1440 × 2302 CSS px

const CAMERA: Record<Format, { rx: [number, number]; rz: [number, number]; s: [number, number]; cx: [number, number]; cy: [number, number]; persp: number }> = {
  "16x9": { rx: [30, 9], rz: [-12, -3], s: [0.86, 1.14], cx: [720, 720], cy: [930, 590], persp: 2400 },
  "1x1": { rx: [32, 11], rz: [-14, -4], s: [0.62, 0.86], cx: [720, 720], cy: [960, 600], persp: 2000 },
};

// The grid is laid out at the camera's largest scale and only ever scaled
// down, so Chrome rasterises the 2x captures at full resolution.
const K = 1.4;

export function Catalogue({ format, dur }: { format: Format; dur: number }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE[format];
  const cam = CAMERA[format];
  const c = ramp(f, 0, dur, easeInOut);
  const rx = mix(cam.rx[0], cam.rx[1], c);
  const rz = mix(cam.rz[0], cam.rz[1], c);
  const s = mix(cam.s[0], cam.s[1], c);
  const cx = mix(cam.cx[0], cam.cx[1], c);
  const cy = mix(cam.cy[0], cam.cy[1], c);

  const photos = C.cards.map((card) => card.photo);
  const gx = photos.reduce((a, p) => a + p.x + p.w / 2, 0) / photos.length;
  const gy = photos.reduce((a, p) => a + p.y + p.h / 2, 0) / photos.length;
  // Landing order: shuffled, so the grid fills from everywhere at once.
  const order = photos.map((_, i) => i).sort((a, b) => rand(a + 7) - rand(b + 7));

  const framesIn = ramp(f, 36, 56);
  const exact = ramp(f, 62, 68);

  return (
    <AbsoluteFill style={{ background: PAPER, perspective: cam.persp, perspectiveOrigin: "50% 50%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: W / 2,
          top: H / 2,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rx}deg) rotateZ(${rz}deg) scale(${s / K})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -cx * K,
            top: -cy * K,
            width: SIZE_CSS.w * K,
            height: SIZE_CSS.h * K,
            transformStyle: "preserve-3d",
            // The capture ends 40 px into a fifth row of cards; fade that sliver out.
            WebkitMaskImage: `linear-gradient(to bottom, #000 0, #000 ${(SIZE_CSS.h - 90) * K}px, transparent ${(SIZE_CSS.h - 30) * K}px)`,
          }}
        >
          <Shot src={C.frames} size={SIZE_CSS} scale={K} style={{ left: 0, top: 0, opacity: framesIn }} />
          {exact < 1 &&
            photos.map((p, i) => {
              const rank = order.indexOf(i);
              const start = 2 + rank * 2.2;
              const t = settle(f, start, { damping: 15, stiffness: 120, mass: 0.9 });
              // Fly in from the side of the frame the slot is on, from in front of the plane.
              let dx = p.x + p.w / 2 - gx;
              let dy = p.y + p.h / 2 - gy;
              const len = Math.hypot(dx, dy) || 1;
              dx /= len;
              dy /= len;
              const side = (rand(i + 31) - 0.5) * 520;
              const ox = (dx * 1700 - dy * side) * K;
              const oy = (dy * 1700 + dx * side) * K;
              const oz = (380 + rand(i + 3) * 520) * K;
              const rot = (rand(i + 11) - 0.5) * 56;
              const k = 1 - t;
              return (
                <Shot
                  key={i}
                  src={C.image}
                  size={SIZE_CSS}
                  crop={p}
                  scale={K}
                  radius={`${11 * K}px ${11 * K}px 0 0`}
                  style={{
                    left: p.x * K,
                    top: p.y * K,
                    opacity: f < start ? 0 : 1,
                    transform: `translate3d(${ox * k}px, ${oy * k}px, ${oz * k}px) rotate(${rot * k}deg)`,
                    boxShadow: `0 ${40 * k}px ${80 * k}px rgba(20, 18, 14, ${0.22 * Math.min(1, k * 2)})`,
                  }}
                />
              );
            })}
          <Shot src={C.image} size={SIZE_CSS} scale={K} style={{ left: 0, top: 0, opacity: exact }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
