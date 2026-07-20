// Global SVG filter that powers the site-wide "liquid glass" material
// (variant B). Referenced from CSS via `backdrop-filter: url(#container-glass)`
// on every glass surface (nav, buttons, panels, card feet, input fields).
//
// A fractal-turbulence field is blurred, then used to displace the backdrop
// into organic ripples, and a final blur frosts the result — so the glass reads
// as wavy, hand-poured material rather than a clean lens. Only Chromium
// (desktop + Android) renders SVG filters inside backdrop-filter, so we gate it
// with the `lg-refraction` class on <html> (see the inline detector in
// app/layout.tsx). Safari / iOS / Firefox fall back to the plain frosted glass
// (+ liquid rim) defined in globals.css.

const SVG = `<svg width="0" height="0" style="position:absolute;width:0;height:0;pointer-events:none" aria-hidden="true">
  <defs>
    <filter id="container-glass" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence"/>
      <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced"/>
      <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur"/>
      <feComposite in="finalBlur" in2="finalBlur" operator="over"/>
    </filter>
  </defs>
</svg>`;

export default function LiquidGlassFilters() {
  return <div aria-hidden style={{ position: "absolute", width: 0, height: 0 }} dangerouslySetInnerHTML={{ __html: SVG }} />;
}
