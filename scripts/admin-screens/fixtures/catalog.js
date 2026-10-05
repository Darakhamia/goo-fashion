// Shared, deterministic fake catalogue for the design harness.
// Mirrors the real data problems from the 2026-10-05 review on purpose
// (ALL-CAPS Zara names, "| Size: XL", French Nike names, "Air Jordan" on non-Jordan items).
const IMG = (id, hex, label) =>
  `https://img.harness/${id}.svg?c=${encodeURIComponent(hex)}&t=${encodeURIComponent(label)}`;

const rows = [
  ["ZARA", "ATHLETICZ OVERSIZED T-SHIRT", "tops", "T-Shirts", "#e8e4dc", "men", 29.9],
  ["ZARA", "ATHLETICZ OVERSIZED T-SHIRT", "tops", "T-Shirts", "#1c1c1c", "men", 29.9],
  ["ZARA", "ATHLETICZ OVERSIZED T-SHIRT", "tops", "T-Shirts", "#6b7a5e", "men", 29.9],
  ["ZARA", "TWISTED WIDE LEG PANT", "bottoms", "Trousers", "#2f3542", "women", 49.9],
  ["ZARA", "MELROSE DENIM PANT", "bottoms", "Jeans", "#4a6fa5", "women", 45.9],
  ["adidas Originals", "Adicolor Classics Firebird Track Top | Size: XL", "tops", "Sweatshirts", "#111827", "unisex", 85],
  ["adidas Originals", "Trefoil Essentials Hoodie | Size: XS", "tops", "Hoodies", "#9ca3af", "unisex", 75],
  ["Nike", "Chaussure de running Pegasus 41 pour homme", "footwear", "Sneakers", "#f3f4f6", "men", 140],
  ["Air Jordan", "Retro Crew Tee — Wonder Steel", "tops", "T-Shirts", "#d1d5db", "men", 45],
  ["Air Jordan", "Silicone Badge Tee", "tops", "T-Shirts", "#0f172a", "men", 40],
  ["Air Jordan", "Air Jordan 1 Retro High OG 'Chicago'", "footwear", "Sneakers", "#b91c1c", "men", 180],
  ["Air Jordan", "Saint Laurent Le 5 Á 7 Hobo Bag", "accessories", "Bags", "#111111", "women", 2450],
  ["Air Jordan", "Bottega Veneta Intrecciato Cardholder", "accessories", "Wallets", "#4d7c0f", "unisex", 420],
  ["Air Jordan", "Puma Speedcat OG", "footwear", "Sneakers", "#dc2626", "unisex", 100],
  ["Alexander Wang", "Wrapped Vest Cardigan", "tops", "Knitwear", "#e5e7eb", "women", 595],
  ["Acne Studios", "Face Patch Crew Neck Sweater", "tops", "Knitwear", "#93c5fd", "unisex", 380],
  ["Acne Studios", "1996 Relaxed Jeans", "bottoms", "Jeans", "#334155", "men", 330],
  ["Fear of God", "Essentials Fleece Hoodie", "tops", "Hoodies", "#a8a29e", "unisex", 100],
  ["Balenciaga", "Track Sneaker", "footwear", "Sneakers", "#f5f5f4", "unisex", 1150],
  ["Valentino Garavani", "Rockstud Leather Belt", "accessories", "Belts", "#000000", "women", 690],
  ["Mm6 Maison Margiela", "Numeric Logo T-Shirt", "tops", "T-Shirts", "#fafafa", "unisex", 195],
  ["Courreges", "Reedition Vinyl Jacket", "outerwear", "Jackets", "#f8fafc", "women", 890],
  ["Converse", "SHAI 001 Lace Up 'Cheetah'", "footwear", "Sneakers", "#d97706", "unisex", 150],
  ["Nike", "High-Low Polo Top", "tops", "Polos", "#1e3a8a", "women", 55],
  ["Steve Madden", "Jenna Thong Platform Sandal", "footwear", "Sandals", "#c2410c", "women", 89],
  ["Stance", "STENCIL ICON SOCK 3 PACK", "accessories", "Socks", "#111827", "unisex", 36],
  ["Osiris", "G2 Skate Shoe", "footwear", "Sneakers", "#000000", "men", 85],
  ["Osiris", "G2 Skate Shoe", "footwear", "Sneakers", "#ffffff", "men", 85],
  ["Osiris", "G2 Skate Shoe", "footwear", "Sneakers", "#7f1d1d", "men", 85],
  ["Osiris", "G2 Skate Shoe", "footwear", "Sneakers", "#1d4ed8", "men", 85],
  ["Thom Browne", "4-Bar Cardigan", "tops", "Knitwear", "#1e293b", "men", 1450],
  ["Comme des Garçons Play", "Heart Logo Tee", "tops", "T-Shirts", "#ffffff", "unisex", 120],
  ["Purple Brand", "P001 Skinny Jeans", "bottoms", "Jeans", "#1f2937", "men", 285],
  ["Moncler", "Maya Short Down Jacket", "outerwear", "Puffers", "#0b1120", "men", 1650],
  ["The Row", "Margaux 15 Bag", "accessories", "Bags", "#78350f", "women", 4900],
  ["Lemaire", "Twisted Shirt", "shirts", "Shirts", "#e7e5e4", "unisex", 410],
  ["Our Legacy", "Box Shirt", "shirts", "Shirts", "#cbd5e1", "men", 260],
  ["Toteme", "Signature Wool Coat", "outerwear", "Coats", "#d6d3d1", "women", 890],
  ["Arket", "Wool Blend Blazer", "outerwear", "Blazers", "#57534e", "men", 199],
  ["COS", "Relaxed Linen Shirt", "shirts", "Shirts", "#f5f5f0", "women", 89],
  ["x Poldo Dog Couture", "Moon Boot dog toy", "accessories", "Other", "#9333ea", "unisex", 45],
];

const now = Date.parse("2026-10-05T10:00:00Z");
const products = rows.map(([brand, name, category, subcategory, hex, gender, price], i) => {
  const id = `0aa26cb7-${String(1000 + i)}-4c1e-9f6a-${String(100000000000 + i * 7919).slice(-12)}`;
  const created = new Date(now - i * 3.7 * 3600e3 * (i > 20 ? 12 : 1)).toISOString();
  const stores = i % 3 === 0 ? ["Farfetch", "SSENSE"] : [i % 2 ? "Zalando" : "Mr Porter"];
  return {
    id, name, brand, category, subcategory,
    description: i < 3 ? "Oversized fit T-shirt with round neck and short sleeves. Zara Athleticz. 26 118 1" : `${name} by ${brand}. Soft hand-feel, relaxed fit.`,
    imageUrl: IMG(id, hex, subcategory),
    images: [IMG(id, hex, subcategory), IMG(id + "b", hex, "detail")],
    colors: [hex === "#000000" || hex === "#111111" ? "Black" : "Mixed"],
    sizes: category === "footwear" ? ["40", "41", "42", "43", "44"] : ["XS", "S", "M", "L", "XL"],
    material: "Cotton",
    retailers: stores.map((s, k) => ({
      name: s, url: `https://www.${s.toLowerCase().replace(/ /g, "")}.com/item/${i}`,
      price: Math.round(price * (1 + k * 0.08) * 100) / 100, currency: "USD",
      availability: k ? "low stock" : "in stock", isOfficial: k === 0,
    })),
    priceMin: price, priceMax: stores.length > 1 ? Math.round(price * 1.08 * 100) / 100 : price,
    currency: "USD",
    isNew: i < 12, isSaved: false,
    styleKeywords: i % 4 === 0 ? ["minimal", "casual"] : [],
    gender: i === 0 ? undefined : gender,
    variantGroupId: name.includes("G2") ? "vg-osiris" : name.includes("ATHLETICZ") ? "vg-zara-tee" : undefined,
    isGroupPrimary: !(name.includes("G2") || name.includes("ATHLETICZ")) || /#e8e4dc|#000000/.test(hex),
    colorHex: hex, bgColor: "#f4f4f2",
    createdAt: created,
  };
});

const brands = [...new Set(rows.map((r) => r[0]))]
  .filter((b) => !["Purple Brand", "Comme des Garçons Play", "Air Jordan", "Courreges", "Mm6 Maison Margiela", "Thom Browne"].includes(b))
  .concat(["sdf", "Z", "Valentino", "Prada", "Gucci", "Loewe", "Jil Sander", "Stone Island", "Carhartt WIP", "Stüssy", "New Balance", "Salomon", "Asics"])
  .sort((a, b) => a.localeCompare(b))
  .map((name, i) => ({ id: i + 1, name, logo_url: null, logoUrl: null }));

module.exports = { products, brands, IMG, TOTAL_PRODUCTS: 1224 };
