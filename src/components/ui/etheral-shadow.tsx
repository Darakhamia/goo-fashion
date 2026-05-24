'use client';

import { CSSProperties } from 'react';

interface EtherealShadowProps {
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export function EtherealShadow({ color = 'rgba(0,0,0,0.18)', style, className }: EtherealShadowProps) {
  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      <style>{`
        @keyframes eth-drift1 {
          0%,100% { transform: translate(0%, 0%) scale(1); }
          33%      { transform: translate(6%, -8%) scale(1.08); }
          66%      { transform: translate(-5%, 6%) scale(0.94); }
        }
        @keyframes eth-drift2 {
          0%,100% { transform: translate(0%, 0%) scale(1); }
          40%      { transform: translate(-8%, 7%) scale(1.1); }
          75%      { transform: translate(5%, -5%) scale(0.92); }
        }
        @keyframes eth-drift3 {
          0%,100% { transform: translate(0%, 0%) scale(1); }
          50%      { transform: translate(7%, 9%) scale(1.06); }
        }
        .eth-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(72px);
          will-change: transform;
          background: var(--eth-color);
        }
        .eth-blob-1 {
          width: 55%; height: 60%;
          top: 10%; left: 15%;
          animation: eth-drift1 14s ease-in-out infinite;
        }
        .eth-blob-2 {
          width: 45%; height: 50%;
          top: 30%; left: 45%;
          opacity: 0.7;
          animation: eth-drift2 18s ease-in-out infinite;
        }
        .eth-blob-3 {
          width: 40%; height: 45%;
          top: 5%; left: 50%;
          opacity: 0.5;
          animation: eth-drift3 22s ease-in-out infinite;
        }
        .eth-blob-4 {
          width: 50%; height: 55%;
          top: 45%; left: 5%;
          opacity: 0.6;
          animation: eth-drift1 20s ease-in-out infinite reverse;
        }
      `}</style>

      <div style={{ '--eth-color': color } as CSSProperties}>
        <div className="eth-blob eth-blob-1" />
        <div className="eth-blob eth-blob-2" />
        <div className="eth-blob eth-blob-3" />
        <div className="eth-blob eth-blob-4" />
      </div>
    </div>
  );
}
