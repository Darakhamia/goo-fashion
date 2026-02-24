import { Outfit } from "@/lib/types";
import { products } from "./products";

export const outfits: Outfit[] = [
  {
    id: "o-001",
    name: "The Considered Minimal",
    description:
      "A study in restraint. Neutral volumes, precise tailoring, understated confidence.",
    occasion: "work",
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=90",
    items: [
      { product: products[4], role: "hero" },
      { product: products[1], role: "secondary" },
      { product: products[3], role: "accent" },
    ],
    totalPriceMin: 2060,
    totalPriceMax: 2390,
    currency: "USD",
    styleKeywords: ["minimal", "classic"],
    isAIGenerated: false,
    isSaved: false,
    season: "all",
  },
  {
    id: "o-002",
    name: "Weekend Softness",
    description:
      "Unstructured ease for the unhurried day. Cashmere, raw denim, quiet luxury.",
    occasion: "casual",
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=90",
    items: [
      { product: products[2], role: "hero" },
      { product: products[5], role: "secondary" },
      { product: products[3], role: "accent" },
    ],
    totalPriceMin: 1550,
    totalPriceMax: 1730,
    currency: "USD",
    styleKeywords: ["minimal", "classic"],
    isAIGenerated: true,
    isSaved: true,
    season: "all",
  },
  {
    id: "o-003",
    name: "Evening Architecture",
    description:
      "Structural lines for after dark. The slip dress as canvas, Chelsea boots as statement.",
    occasion: "evening",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=90",
    items: [
      { product: products[6], role: "hero" },
      { product: products[3], role: "accent" },
    ],
    totalPriceMin: 2020,
    totalPriceMax: 2270,
    currency: "USD",
    styleKeywords: ["avant-garde", "minimal"],
    isAIGenerated: true,
    isSaved: false,
    season: "all",
  },
  {
    id: "o-004",
    name: "The Sunday Coat",
    description:
      "An overcoat and nothing else. Volume and restraint in equal measure.",
    occasion: "weekend",
    imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=90",
    items: [
      { product: products[0], role: "hero" },
      { product: products[7], role: "secondary" },
      { product: products[5], role: "secondary" },
      { product: products[3], role: "accent" },
    ],
    totalPriceMin: 1745,
    totalPriceMax: 2070,
    currency: "USD",
    styleKeywords: ["minimal", "classic"],
    isAIGenerated: false,
    isSaved: false,
    season: "autumn",
  },
  {
    id: "o-005",
    name: "Office Quiet",
    description:
      "Tailored restraint. When the work speaks for itself, the wardrobe follows suit.",
    occasion: "work",
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90",
    items: [
      { product: products[4], role: "hero" },
      { product: products[7], role: "secondary" },
      { product: products[1], role: "secondary" },
    ],
    totalPriceMin: 1615,
    totalPriceMax: 1880,
    currency: "USD",
    styleKeywords: ["minimal", "classic"],
    isAIGenerated: true,
    isSaved: false,
    season: "all",
  },
  {
    id: "o-006",
    name: "Dusk Palette",
    description:
      "Warm tonals for the in-between hour. Wool, cashmere, quiet earth tones.",
    occasion: "casual",
    imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=90",
    items: [
      { product: products[0], role: "hero" },
      { product: products[2], role: "secondary" },
      { product: products[5], role: "secondary" },
    ],
    totalPriceMin: 1920,
    totalPriceMax: 2090,
    currency: "USD",
    styleKeywords: ["minimal", "classic"],
    isAIGenerated: true,
    isSaved: false,
    season: "autumn",
  },
];

export const getOutfitById = (id: string): Outfit | undefined =>
  outfits.find((o) => o.id === id);

export const getAIOutfits = (): Outfit[] =>
  outfits.filter((o) => o.isAIGenerated);

export const getFeaturedOutfits = (): Outfit[] =>
  outfits.slice(0, 4);
