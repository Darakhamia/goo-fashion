// Scene 4: the AI stylist opens over the dimmed browse page. "What's
// trending?" is typed and sent; three dots; the scripted reply arrives word by
// word with two pieces and the "Build this look" card. Nothing is generated.
import React from "react";
import { useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { easeDrawer, easeInOut, mix, ramp, settle } from "../motion";
import { Panel } from "../ui/Panel";
import { Cursor } from "../ui/Cursor";
import { BrowsePage } from "../ui/app/BrowsePage";
import { StylistSheet } from "../ui/app/StylistSheet";
import { browseAt } from "./Browse";
import { STYLIST } from "../fixtures/story";

export const STY = { open: 6, typeFrom: 28, typeTo: 50, send: 58, typingTo: 78, reply: 78, tiles: [94, 98] as const, card: 104 };

// Thread geometry (CSS px), for keeping the newest message in view.
const THREAD = { top: 12, greeting: 85, user: 43, typing: 44, reply: 85, tiles: 152, card: 72, bottom: 16, gap: 10, inner: 8 };

export function stylistState(f: number, threadVisible: number) {
  const typed = Math.round(STYLIST.question.length * ramp(f, STY.typeFrom, STY.typeTo, (t) => t));
  const sent = f >= STY.send + 1;
  const user = Math.min(1, settle(f, STY.send + 1));
  const typing = f >= STY.send + 4 && f < STY.reply ? ramp(f, STY.send + 4, STY.send + 8) : 0;
  const reply = Math.min(1, settle(f, STY.reply, { damping: 20 }));
  const words = STYLIST.reply.split(" ").length;
  const replyWords = words * ramp(f, STY.reply, STY.reply + 18, (t) => t);
  const tiles: [number, number] = [Math.min(1, settle(f, STY.tiles[0])), Math.min(1, settle(f, STY.tiles[1]))];
  const card = Math.min(1, settle(f, STY.card));
  const content =
    THREAD.top + THREAD.greeting + THREAD.bottom +
    user * (THREAD.gap + THREAD.user) +
    (f < STY.reply ? typing * (THREAD.gap + THREAD.typing) : 0) +
    ramp(f, STY.reply, STY.reply + 6) * (THREAD.gap + THREAD.reply) +
    ramp(f, STY.tiles[0], STY.tiles[0] + 8) * (THREAD.inner + THREAD.tiles) +
    ramp(f, STY.card, STY.card + 8) * (THREAD.inner + THREAD.card);
  const d = f - STY.send;
  return {
    input: sent ? "" : STYLIST.question.slice(0, typed),
    focus: ramp(f, STY.typeFrom - 6, STY.typeFrom),
    sendPress: d >= 0 && d <= 5 ? (d <= 2 ? d / 2 : 1 - (d - 2) / 3) : 0,
    user: sent ? user : 0,
    typing,
    seconds: f / 30,
    reply: f >= STY.reply ? reply : 0,
    replyWords,
    tiles,
    card: f >= STY.card ? card : 0,
    scroll: Math.max(0, content - threadVisible),
  };
}

export function StylistScene({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  const S = L.sheet;
  const sheetW = S.w / S.scale;
  const sheetH = S.h / S.scale;
  const threadVisible = sheetH - 12 - 56 - 50 - 66;
  const bgIn = ramp(f, 0, 14);
  const open = ramp(f, STY.open, STY.open + 20, easeDrawer);
  const leave = ramp(f, 116, 132, easeInOut);
  const push = mix(1, 1.04, ramp(f, 16, 132, easeInOut));
  const b = browseAt(L, 999);
  const st = stylistState(f, threadVisible);
  // Composer and send button, in frame px (the sheet is scaled from its top-left).
  const rowY = S.y + (sheetH - 16 - 25) * S.scale;
  const sendX = S.x + (sheetW - 16 - 6 - 19) * S.scale;
  const fieldX = S.x + (16 + 70) * S.scale;
  const fx = S.x + S.w / 2;
  const fy = S.y + S.h / 2;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 1 - leave,
        transform: `scale(${push})`,
        transformOrigin: `${fx}px ${fy}px`,
      }}
    >
      <Panel rect={L.panel} scale={L.panelScale} scrollY={b.scrollY} opacity={bgIn} dim={0.6 * ramp(f, 2, 16)}>
        <BrowsePage width={L.panel.w / L.panelScale} chips={b.chips} grid={b.grid} gridShift={b.gridShift} />
      </Panel>
      <div
        data-match-scope="stylist"
        style={{
          position: "absolute",
          left: S.x,
          top: S.y,
          width: S.w,
          height: S.h,
          opacity: open,
          transform: `translateX(${mix(120, 0, open)}px)`,
        }}
      >
        <div style={{ transform: `scale(${S.scale})`, transformOrigin: "0 0" }}>
          <StylistSheet
            width={sheetW}
            height={sheetH}
            greeting={STYLIST.greeting}
            question={STYLIST.question}
            reply={STYLIST.reply}
            suggestions={STYLIST.suggestions}
            quickReplies={STYLIST.quickReplies}
            st={st}
          />
        </div>
      </div>
      <Cursor
        size={L.cursorSize}
        appear={14}
        vanish={72}
        presses={[24, STY.send]}
        path={[
          { f: 14, x: fieldX - 90, y: rowY + 130 },
          { f: 23, x: fieldX, y: rowY + 6 },
          { f: 50, x: fieldX + 10, y: rowY + 10 },
          { f: 56, x: sendX + 4, y: rowY + 4 },
          { f: 72, x: sendX + 10, y: rowY + 30 },
        ]}
      />
    </div>
  );
}
