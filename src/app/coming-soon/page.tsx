export const metadata = {
  title: "Coming Soon — GOO",
  description: "Something new is on the way. GOO — AI-powered personal styling.",
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <header className="px-8 md:px-16 pt-10">
        <span className="text-[11px] tracking-[0.28em] uppercase font-medium text-white/40">
          GOO
        </span>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-20">
        <div className="max-w-3xl">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-white/30 mb-8">
            Coming Soon
          </p>
          <h1
            className="font-display text-6xl md:text-8xl lg:text-[9rem] font-light text-white leading-[0.92] tracking-tight mb-10"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dress like
            <br />
            <em>you think.</em>
          </h1>
          <p className="text-sm md:text-base text-white/50 leading-relaxed max-w-md mb-16">
            AI builds complete outfits around your style, body, and budget.
            Premium brands, price-compared. Launching soon.
          </p>

          {/* Info blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
            {[
              {
                label: "01",
                title: "AI Stylist",
                body: "Tell GOO your occasion and mood. Receive a complete outfit curated for you — instantly.",
              },
              {
                label: "02",
                title: "Smart Wardrobe",
                body: "Build your wardrobe profile once. The AI refines its picks with every session.",
              },
              {
                label: "03",
                title: "Best Prices",
                body: "Every item is compared across 50+ retailers. You always see the lowest price.",
              },
            ].map((block) => (
              <div
                key={block.label}
                className="bg-[#0A0A0A] px-7 py-8 flex flex-col gap-5"
              >
                <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-white/25">
                  {block.label}
                </span>
                <div>
                  <h3
                    className="font-display text-lg font-light text-white mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {block.title}
                  </h3>
                  <p className="text-xs text-white/40 leading-relaxed">
                    {block.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 md:px-16 pb-10 flex items-center justify-between">
        <p className="text-[10px] tracking-[0.16em] uppercase text-white/20">
          © 2026 GOO
        </p>
        <p className="text-[10px] tracking-[0.16em] uppercase text-white/20">
          AI · Fashion · Personal Style
        </p>
      </footer>
    </main>
  );
}
