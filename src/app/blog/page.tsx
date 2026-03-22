import Link from "next/link";
import SectionLabel from "@/components/ui/SectionLabel";

const posts = [
  {
    slug: "how-ai-builds-your-outfit",
    category: "AI Stylist",
    date: "March 18, 2026",
    title: "How AI builds your perfect outfit from scratch",
    excerpt:
      "Behind the scenes of GOO's styling engine — how it weighs color theory, proportions, and occasion context to assemble looks that feel personal.",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    readTime: "5 min",
  },
  {
    slug: "capsule-wardrobe-2026",
    category: "Style Guide",
    date: "March 12, 2026",
    title: "The 12-piece capsule wardrobe for 2026",
    excerpt:
      "Fewer pieces, more combinations. We broke down the essentials that work across seasons — and the brands that do them best at every price point.",
    image:
      "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=800&q=80",
    readTime: "7 min",
  },
  {
    slug: "price-comparison-guide",
    category: "Smart Shopping",
    date: "March 5, 2026",
    title: "Same piece, 11 retailers: what we found",
    excerpt:
      "We tracked a single Toteme shirt across 11 platforms for 30 days. Price swings reached 40%. Here's when to buy — and when to wait.",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    readTime: "4 min",
  },
  {
    slug: "color-theory-getting-dressed",
    category: "Style Guide",
    date: "Feb 27, 2026",
    title: "Color theory for getting dressed, not for design school",
    excerpt:
      "Forget the color wheel. These are the rules that actually matter when you're standing in front of your wardrobe at 8am.",
    image:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
    readTime: "6 min",
  },
  {
    slug: "brands-worth-paying-for",
    category: "Brands",
    date: "Feb 19, 2026",
    title: "5 brands worth paying full price for",
    excerpt:
      "Most fashion is overpriced. These five are underpriced relative to what they deliver — and we'll explain exactly why, piece by piece.",
    image:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80",
    readTime: "8 min",
  },
  {
    slug: "dressing-for-body-type",
    category: "AI Stylist",
    date: "Feb 10, 2026",
    title: "Dressing for your body: what the data actually shows",
    excerpt:
      "GOO analyzed 120,000 outfit ratings to find which proportions consistently score highest — and which common rules are myths.",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
    readTime: "6 min",
  },
];

export default function BlogPage() {
  const [featured, ...rest] = posts;

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">

        {/* Header */}
        <div className="pt-16 md:pt-24 mb-16 md:mb-20">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
            Journal
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-light text-[var(--foreground)] leading-[0.95] tracking-tight">
            Style, explained.
          </h1>
        </div>

        {/* Featured post */}
        <Link href={`/blog/${featured.slug}`} className="group block mb-px">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)]">
            <div className="bg-[var(--background)] overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                />
              </div>
            </div>
            <div className="bg-[var(--background)] p-8 md:p-12 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[9px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] border border-[var(--border)] px-2.5 py-1">
                    {featured.category}
                  </span>
                  <span className="text-[10px] text-[var(--foreground-subtle)]">
                    {featured.readTime} read
                  </span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] leading-snug mb-4 group-hover:opacity-70 transition-opacity duration-200">
                  {featured.title}
                </h2>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                  {featured.excerpt}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-xs text-[var(--foreground-subtle)]">
                  {featured.date}
                </span>
                <span className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors duration-200">
                  Read →
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Post grid */}
        <div className="mt-px grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group bg-[var(--background)] flex flex-col"
            >
              <div className="overflow-hidden aspect-[3/2]">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)]">
                    {post.category}
                  </span>
                  <span className="w-px h-3 bg-[var(--border-strong)]" />
                  <span className="text-[10px] text-[var(--foreground-subtle)]">
                    {post.readTime} read
                  </span>
                </div>
                <h3 className="font-display text-lg font-light text-[var(--foreground)] leading-snug mb-3 group-hover:opacity-70 transition-opacity duration-200">
                  {post.title}
                </h3>
                <p className="text-xs text-[var(--foreground-muted)] leading-relaxed flex-1">
                  {post.excerpt}
                </p>
                <p className="mt-4 text-[10px] text-[var(--foreground-subtle)]">
                  {post.date}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter strip */}
        <div className="mt-px bg-[var(--border)]">
          <div className="bg-[var(--surface)] px-8 md:px-16 py-12 md:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
                Newsletter
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)]">
                Style notes, weekly.
              </h2>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                One email. No spam. Unsubscribe anytime.
              </p>
            </div>
            <div className="flex gap-0 w-full md:w-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 md:w-64 px-4 py-3 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--foreground-muted)] transition-colors duration-200"
              />
              <button className="px-6 py-3 text-xs tracking-[0.14em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity duration-200 shrink-0">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="mb-16" />
      </div>
    </div>
  );
}
