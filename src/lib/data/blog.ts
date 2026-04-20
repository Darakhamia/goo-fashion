import type { BlogPost } from "@/lib/types";

/**
 * Static fallback used when Supabase is not configured.
 * The live blog reads from the blog_posts table; these entries mirror what
 * used to be hardcoded in /blog/page.tsx so the site still renders offline.
 */
export const blogPosts: BlogPost[] = [
  {
    id: "static-1",
    slug: "how-ai-builds-your-outfit",
    title: "How AI builds your perfect outfit from scratch",
    excerpt:
      "Behind the scenes of GOO's styling engine — how it weighs color theory, proportions, and occasion context to assemble looks that feel personal.",
    body: "",
    category: "AI Stylist",
    coverImageUrl:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    readTime: "5 min",
    authorName: "GOO",
    isPublished: true,
    publishedAt: "2026-03-18T00:00:00.000Z",
    createdAt: "2026-03-18T00:00:00.000Z",
    updatedAt: "2026-03-18T00:00:00.000Z",
  },
  {
    id: "static-2",
    slug: "capsule-wardrobe-2026",
    title: "The 12-piece capsule wardrobe for 2026",
    excerpt:
      "Fewer pieces, more combinations. We broke down the essentials that work across seasons — and the brands that do them best at every price point.",
    body: "",
    category: "Style Guide",
    coverImageUrl:
      "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=800&q=80",
    readTime: "7 min",
    authorName: "GOO",
    isPublished: true,
    publishedAt: "2026-03-12T00:00:00.000Z",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z",
  },
  {
    id: "static-3",
    slug: "price-comparison-guide",
    title: "Same piece, 11 retailers: what we found",
    excerpt:
      "We tracked a single Toteme shirt across 11 platforms for 30 days. Price swings reached 40%. Here's when to buy — and when to wait.",
    body: "",
    category: "Smart Shopping",
    coverImageUrl:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    readTime: "4 min",
    authorName: "GOO",
    isPublished: true,
    publishedAt: "2026-03-05T00:00:00.000Z",
    createdAt: "2026-03-05T00:00:00.000Z",
    updatedAt: "2026-03-05T00:00:00.000Z",
  },
  {
    id: "static-4",
    slug: "color-theory-getting-dressed",
    title: "Color theory for getting dressed, not for design school",
    excerpt:
      "Forget the color wheel. These are the rules that actually matter when you're standing in front of your wardrobe at 8am.",
    body: "",
    category: "Style Guide",
    coverImageUrl:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
    readTime: "6 min",
    authorName: "GOO",
    isPublished: true,
    publishedAt: "2026-02-27T00:00:00.000Z",
    createdAt: "2026-02-27T00:00:00.000Z",
    updatedAt: "2026-02-27T00:00:00.000Z",
  },
  {
    id: "static-5",
    slug: "brands-worth-paying-for",
    title: "5 brands worth paying full price for",
    excerpt:
      "Most fashion is overpriced. These five are underpriced relative to what they deliver — and we'll explain exactly why, piece by piece.",
    body: "",
    category: "Brands",
    coverImageUrl:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80",
    readTime: "8 min",
    authorName: "GOO",
    isPublished: true,
    publishedAt: "2026-02-19T00:00:00.000Z",
    createdAt: "2026-02-19T00:00:00.000Z",
    updatedAt: "2026-02-19T00:00:00.000Z",
  },
  {
    id: "static-6",
    slug: "dressing-for-body-type",
    title: "Dressing for your body: what the data actually shows",
    excerpt:
      "GOO analyzed 120,000 outfit ratings to find which proportions consistently score highest — and which common rules are myths.",
    body: "",
    category: "AI Stylist",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
    readTime: "6 min",
    authorName: "GOO",
    isPublished: true,
    publishedAt: "2026-02-10T00:00:00.000Z",
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-02-10T00:00:00.000Z",
  },
];
