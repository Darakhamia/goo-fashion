// A plain phone body around a 390 px wide screen, with a status bar in the
// page's own colours. The screen below the status bar is the web page.
import React from "react";

export const PHONE = { screenW: 390, statusH: 50, appH: 790, bezel: 15 };
export const PHONE_W = PHONE.screenW + PHONE.bezel * 2;
export const PHONE_H = PHONE.statusH + PHONE.appH + PHONE.bezel * 2;

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        padding: PHONE.bezel,
        borderRadius: 70,
        background: "#111",
        boxShadow: "inset 0 0 0 2px #3b3a38, inset 0 0 0 6px #050505, 0 50px 110px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: PHONE.screenW,
          height: PHONE.statusH + PHONE.appH,
          borderRadius: 55,
          overflow: "hidden",
          background: "var(--background)",
        }}
      >
        <div
          className="flex items-center justify-between text-[var(--foreground)]"
          style={{ height: PHONE.statusH, padding: "4px 32px 0 46px", fontWeight: 600, fontSize: 16.5, letterSpacing: "-0.01em" }}
        >
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
            <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .4C5.2.4 2.6 1.5.8 3.3L2 4.6a8.6 8.6 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.3-1.3A6.7 6.7 0 0 0 8 4c-1.8 0-3.4.7-4.7 1.8l1.3 1.3C5.5 6.3 6.7 5.8 8 5.8Zm0 3.5c-.5 0-1 .2-1.4.5L8 11.6l1.4-1.8c-.4-.3-.9-.5-1.4-.5Z" fill="currentColor" /></svg>
            <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" stroke="currentColor" opacity=".4" fill="none" /><rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor" /><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".45" /></svg>
          </span>
        </div>
        <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)", width: 122, height: 36, borderRadius: 20, background: "#000" }} />
        <div style={{ position: "absolute", top: PHONE.statusH, left: 0 }}>{children}</div>
      </div>
    </div>
  );
}
