'use client';

import { CSSProperties } from 'react';

interface EtherealShadowProps {
  style?: CSSProperties;
  className?: string;
}

/*
 * Pure CSS animated background — no SVG filters, no JS, no rAF.
 * Only `transform` and `opacity` are animated, both GPU-composited.
 * Replaces the expensive feTurbulence + feDisplacementMap approach.
 */
export function EtherealShadow({ style, className }: EtherealShadowProps) {
  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      <style>{`
        @keyframes eth-a {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(7%,-10%) scale(1.07); }
          66%      { transform: translate(-6%,8%) scale(0.95); }
        }
        @keyframes eth-b {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-9%,8%) scale(1.09); }
          75%      { transform: translate(6%,-6%) scale(0.93); }
        }
        @keyframes eth-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(8%,10%) scale(1.05); }
        }
        .eth-wrap { position:absolute; inset:0; pointer-events:none; }
        .eth-blob {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
          filter: blur(80px);
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.14) 0%, transparent 70%);
        }
        .eth-b1 {
          width:70%; height:65%;
          top:5%; left:10%;
          animation: eth-a 20s ease-in-out infinite;
        }
        .eth-b2 {
          width:55%; height:60%;
          top:25%; left:38%;
          opacity:.75;
          animation: eth-b 26s ease-in-out infinite;
        }
        .eth-b3 {
          width:50%; height:55%;
          bottom:0%; left:5%;
          opacity:.6;
          animation: eth-c 30s ease-in-out infinite;
        }
        /* Static grain texture — no animation, no GPU cost */
        .eth-grain {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px);
          background-size: 3px 3px;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .eth-blob { animation: none !important; }
        }
      `}</style>

      <div className="eth-wrap">
        <div className="eth-blob eth-b1" />
        <div className="eth-blob eth-b2" />
        <div className="eth-blob eth-b3" />
        <div className="eth-grain" />
      </div>
    </div>
  );
}
