// A desktop page playing in a "screen" on the stage. The page is laid out in
// CSS px at `viewportW` wide and scaled to the panel; a camera can push in on a
// point of the panel and the page can scroll. Content is clipped by the panel's
// own rounded edge, so any cut is the viewport's, never the video frame's.
import React from "react";
import type { Rect } from "../layout";

export function Panel({
  rect,
  scale,
  scrollY = 0,
  zoom = 1,
  focus,
  opacity = 1,
  translateY = 0,
  outerScale = 1,
  dim = 0,
  radius = 26,
  camera,
  children,
}: {
  /** A camera instead of scale/scroll/zoom: CSS px per panel px, and the page
   *  point (CSS px) that sits at the panel's centre. */
  camera?: { scale: number; cx: number; cy: number };
  rect: Rect;
  /** Video px per CSS px. */
  scale: number;
  scrollY?: number;
  zoom?: number;
  /** Push-in origin, in panel px (defaults to the centre). */
  focus?: { x: number; y: number };
  opacity?: number;
  translateY?: number;
  /** Scale of the whole panel (recede / arrive). */
  outerScale?: number;
  /** 0–1 black veil over the page. */
  dim?: number;
  radius?: number;
  children: React.ReactNode;
}) {
  if (camera) {
    // Same page, placed by its centre point: translate then scale.
    zoom = 1;
    scale = camera.scale;
    scrollY = 0;
  }
  const vw = camera ? 100000 : rect.w / scale;
  const vh = camera ? 100000 : rect.h / scale;
  const camX = camera ? rect.w / 2 - camera.cx * camera.scale : 0;
  const camY = camera ? rect.h / 2 - camera.cy * camera.scale : 0;
  const fx = focus?.x ?? rect.w / 2;
  const fy = focus?.y ?? rect.h / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: radius,
        overflow: "hidden",
        background: "var(--background)",
        boxShadow: "0 0 0 1px var(--border-strong), 0 40px 120px rgba(0,0,0,0.55)",
        opacity,
        transform: `translateY(${translateY}px) scale(${outerScale})`,
        transformOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: `${fx}px ${fy}px`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: camX,
            top: camY,
            width: vw,
            height: vh,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            overflow: "hidden",
          }}
        >
          <div style={{ transform: `translateY(${-scrollY}px)` }}>{children}</div>
        </div>
      </div>
      {dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${dim})` }} />}
    </div>
  );
}
