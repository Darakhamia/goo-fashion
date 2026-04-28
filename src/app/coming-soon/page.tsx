import FeatureCarousel from "./FeatureCarousel";

export const metadata = {
  title: "Coming Soon — GOO",
  description: "Something new is on the way. GOO — AI-powered personal styling.",
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <header className="px-8 md:px-14 pt-10 shrink-0">
        <span className="text-[11px] tracking-[0.28em] uppercase font-medium text-white/30">
          GOO
        </span>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-12 lg:gap-0 px-8 md:px-14 py-14 lg:py-0">

        {/* Left — hero text */}
        <div className="flex flex-col justify-center lg:pr-16 lg:w-1/2 lg:py-20">
          <p className="text-[10px] tracking-[0.24em] uppercase font-medium text-white/25 mb-8">
            Coming Soon
          </p>
          <h1
            className="font-display text-[clamp(3.5rem,8vw,7.5rem)] font-light text-white leading-[0.9] tracking-tight mb-8"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dress like
            <br />
            <em>you think.</em>
          </h1>
          <p className="text-sm text-white/40 leading-relaxed max-w-xs">
            AI builds complete outfits around your style, body, and budget.
            Premium brands, price-compared.
          </p>

          {/* Divider */}
          <div className="mt-12 w-12 h-px bg-white/10" />

          <p className="mt-5 text-[10px] tracking-[0.2em] uppercase text-white/20">
            Launching 2026
          </p>
        </div>

        {/* Right — carousel */}
        <div className="lg:w-1/2 flex flex-col justify-center lg:border-l lg:border-white/[0.06] lg:pl-16 lg:py-20">
          <FeatureCarousel />
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 md:px-14 pb-8 shrink-0 flex items-center justify-between">
        <p className="text-[10px] tracking-[0.14em] uppercase text-white/15">
          © 2026 GOO
        </p>
        <p className="text-[10px] tracking-[0.14em] uppercase text-white/15">
          AI · Fashion · Personal Style
        </p>
      </footer>
    </main>
  );
}
