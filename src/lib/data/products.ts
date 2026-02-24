import { Product } from "@/lib/types";

export const products: Product[] = [
  {
    id: "p-001",
    name: "Oversized Wool Coat",
    brand: "Toteme",
    category: "outerwear",
    description:
      "A generous silhouette in double-faced wool. Notch lapels, side pockets. Relaxed, confident.",
    imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=90",
      "https://images.unsplash.com/photo-1520975954732-35dd22299614?w=800&q=90",
    ],
    colors: ["Camel", "Charcoal", "Ecru"],
    sizes: ["XS", "S", "M", "L", "XL"],
    material: "90% Wool, 10% Cashmere",
    priceMin: 890,
    priceMax: 980,
    currency: "USD",
    retailers: [
      { name: "Toteme Official", url: "#", price: 980, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "Net-a-Porter", url: "#", price: 920, currency: "USD", availability: "low stock", isOfficial: false },
      { name: "MyTheresa", url: "#", price: 890, currency: "USD", availability: "in stock", isOfficial: false },
    ],
    isNew: true,
    isSaved: false,
    styleKeywords: ["minimal", "classic"],
  },
  {
    id: "p-002",
    name: "Wide-Leg Trousers",
    brand: "Lemaire",
    category: "bottoms",
    description:
      "High-waisted wide-leg trousers in a silk-touch finish. Fluid, architectural. Front pleats.",
    imageUrl: "https://images.unsplash.com/photo-1594938298603-a8fac2f72b64?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1594938298603-a8fac2f72b64?w=800&q=90",
    ],
    colors: ["Black", "Milk", "Tobacco"],
    sizes: ["34", "36", "38", "40", "42"],
    material: "100% Viscose",
    priceMin: 420,
    priceMax: 490,
    currency: "USD",
    retailers: [
      { name: "Lemaire Official", url: "#", price: 490, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "SSENSE", url: "#", price: 450, currency: "USD", availability: "in stock", isOfficial: false },
      { name: "Farfetch", url: "#", price: 420, currency: "USD", availability: "low stock", isOfficial: false },
    ],
    isNew: false,
    isSaved: true,
    styleKeywords: ["minimal", "avant-garde"],
  },
  {
    id: "p-003",
    name: "Cashmere Crew Neck",
    brand: "The Row",
    category: "knitwear",
    description:
      "Relaxed crew neck in Grade-A cashmere. The foundation of a considered wardrobe.",
    imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=90",
    ],
    colors: ["Ivory", "Stone", "Black", "Pale Blue"],
    sizes: ["XS", "S", "M", "L"],
    material: "100% Grade-A Cashmere",
    priceMin: 790,
    priceMax: 850,
    currency: "USD",
    retailers: [
      { name: "The Row Official", url: "#", price: 850, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "Net-a-Porter", url: "#", price: 820, currency: "USD", availability: "in stock", isOfficial: false },
      { name: "Bergdorf Goodman", url: "#", price: 790, currency: "USD", availability: "low stock", isOfficial: false },
    ],
    isNew: false,
    isSaved: false,
    styleKeywords: ["minimal", "classic"],
  },
  {
    id: "p-004",
    name: "Chelsea Boots",
    brand: "Acne Studios",
    category: "footwear",
    description:
      "Sleek Chelsea boots in polished calf leather. Elastic side panels. Stacked heel.",
    imageUrl: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&q=90",
    ],
    colors: ["Black", "Dark Brown"],
    sizes: ["36", "37", "38", "39", "40", "41", "42"],
    material: "100% Calf Leather",
    priceMin: 540,
    priceMax: 620,
    currency: "USD",
    retailers: [
      { name: "Acne Studios Official", url: "#", price: 620, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "SSENSE", url: "#", price: 580, currency: "USD", availability: "in stock", isOfficial: false },
      { name: "Farfetch", url: "#", price: 540, currency: "USD", availability: "in stock", isOfficial: false },
    ],
    isNew: true,
    isSaved: false,
    styleKeywords: ["minimal", "classic"],
  },
  {
    id: "p-005",
    name: "Structured Blazer",
    brand: "Jil Sander",
    category: "outerwear",
    description:
      "Single-breasted structured blazer in virgin wool. Precise tailoring. Minimal hardware.",
    imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=90",
    ],
    colors: ["Ecru", "Black", "Navy"],
    sizes: ["34", "36", "38", "40", "42", "44"],
    material: "100% Virgin Wool",
    priceMin: 1100,
    priceMax: 1280,
    currency: "USD",
    retailers: [
      { name: "Jil Sander Official", url: "#", price: 1280, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "Net-a-Porter", url: "#", price: 1180, currency: "USD", availability: "low stock", isOfficial: false },
      { name: "MyTheresa", url: "#", price: 1100, currency: "USD", availability: "in stock", isOfficial: false },
    ],
    isNew: false,
    isSaved: false,
    styleKeywords: ["minimal", "classic", "avant-garde"],
  },
  {
    id: "p-006",
    name: "Straight-Leg Denim",
    brand: "A.P.C.",
    category: "bottoms",
    description:
      "Raw selvedge denim in a clean straight cut. Rigid, honest. Fades with wear.",
    imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=90",
    ],
    colors: ["Indigo", "Black", "Ecru"],
    sizes: ["24", "25", "26", "27", "28", "29", "30", "31", "32"],
    material: "100% Selvedge Denim",
    priceMin: 220,
    priceMax: 260,
    currency: "USD",
    retailers: [
      { name: "A.P.C. Official", url: "#", price: 260, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "SSENSE", url: "#", price: 240, currency: "USD", availability: "in stock", isOfficial: false },
      { name: "Farfetch", url: "#", price: 220, currency: "USD", availability: "in stock", isOfficial: false },
    ],
    isNew: false,
    isSaved: true,
    styleKeywords: ["minimal", "classic"],
  },
  {
    id: "p-007",
    name: "Silk Slip Dress",
    brand: "Maison Margiela",
    category: "dresses",
    description:
      "Deconstructed silk slip dress. Understated luxury with an architectural twist.",
    imageUrl: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=800&q=90",
    ],
    colors: ["Champagne", "Ivory", "Pale Rose"],
    sizes: ["34", "36", "38", "40", "42"],
    material: "100% Silk",
    priceMin: 1480,
    priceMax: 1650,
    currency: "USD",
    retailers: [
      { name: "Maison Margiela Official", url: "#", price: 1650, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "Net-a-Porter", url: "#", price: 1560, currency: "USD", availability: "low stock", isOfficial: false },
      { name: "Farfetch", url: "#", price: 1480, currency: "USD", availability: "in stock", isOfficial: false },
    ],
    isNew: true,
    isSaved: false,
    styleKeywords: ["avant-garde", "minimal"],
  },
  {
    id: "p-008",
    name: "Linen Shirt",
    brand: "Cos",
    category: "tops",
    description:
      "Relaxed linen shirt with a rounded hem. Light, breathable. Everyday wear elevated.",
    imageUrl: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=90",
    images: [
      "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=90",
    ],
    colors: ["White", "Light Blue", "Ecru", "Sage"],
    sizes: ["XS", "S", "M", "L", "XL"],
    material: "100% Linen",
    priceMin: 95,
    priceMax: 110,
    currency: "USD",
    retailers: [
      { name: "COS Official", url: "#", price: 110, currency: "USD", availability: "in stock", isOfficial: true },
      { name: "Zalando", url: "#", price: 95, currency: "USD", availability: "in stock", isOfficial: false },
    ],
    isNew: false,
    isSaved: false,
    styleKeywords: ["minimal", "classic"],
  },
];

export const getProductById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);

export const getProductsByCategory = (category: string): Product[] =>
  products.filter((p) => p.category === category);

export const getFeaturedProducts = (): Product[] =>
  products.slice(0, 6);
