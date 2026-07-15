// Global SVG filters that power the "liquid glass" refraction on the nav and
// glass buttons. Referenced from CSS via `backdrop-filter: url(#lg)` /
// `url(#lgb)`. Only Chromium (desktop + Android) actually renders SVG filters
// in backdrop-filter — we gate that with the `lg-refraction` class on <html>
// (see the inline detector in app/layout.tsx). Safari / iOS / Firefox fall back
// to the plain frosted glass defined in globals.css.
//
// The displacement map is an inline data-URI SVG: a horizontal red ramp (R
// channel → X displacement) screen-blended with a vertical green ramp (G
// channel → Y displacement), both centred on 128 so the middle stays neutral
// and the edges bend the backdrop outward like a lens. Each colour channel is
// displaced at a slightly different scale to fake chromatic dispersion
// (the rainbow fringing on the edges).

const MAP =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iODAiPgogIDxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iODAiIGZpbGw9IiMwMDAiLz4KICA8cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjgwIiBmaWxsPSJ1cmwoI2gpIi8+CiAgPHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSI4MCIgZmlsbD0idXJsKCN2KSIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOnNjcmVlbiIvPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJoIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMCI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzAwMDAwMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzgwMDAwMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNmZjAwMDAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InYiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDAwMDAwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjMDA4MDAwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAwZmYwMCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+Cjwvc3ZnPg==";

// `warp` adds a subtle organic distortion (low-frequency turbulence) on top of
// the clean lens, so the glass looks slightly imperfect / hand-blown rather
// than a perfect magnifier. Keep it small.
function filter(id: string, scales: [number, number, number], blur: number, warp = 0) {
  const [r, g, b] = scales;
  const warpPass =
    warp > 0
      ? `
      <feTurbulence type="fractalNoise" baseFrequency="0.010 0.014" numOctaves="2" seed="7" result="noise"/>
      <feDisplacementMap in="disp" in2="noise" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="disp"/>`
      : "";
  return `
    <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage href="${MAP}" result="map" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${r}" xChannelSelector="R" yChannelSelector="G" result="rD"/>
      <feColorMatrix in="rD" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rC"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${g}" xChannelSelector="R" yChannelSelector="G" result="gD"/>
      <feColorMatrix in="gD" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="gC"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${b}" xChannelSelector="R" yChannelSelector="G" result="bD"/>
      <feColorMatrix in="bD" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bC"/>
      <feBlend in="rC" in2="gC" mode="screen" result="rg"/>
      <feBlend in="rg" in2="bC" mode="screen" result="disp"/>${warpPass}
      <feGaussianBlur in="disp" stdDeviation="${blur}"/>
    </filter>`;
}

const SVG = `<svg width="0" height="0" style="position:absolute;width:0;height:0;pointer-events:none" aria-hidden="true">
  <defs>
    ${filter("lg", [56, 48, 40], 1.1, 6)}
    ${filter("lgb", [34, 28, 22], 0.8)}
  </defs>
</svg>`;

export default function LiquidGlassFilters() {
  return <div aria-hidden style={{ position: "absolute", width: 0, height: 0 }} dangerouslySetInnerHTML={{ __html: SVG }} />;
}
