// Fixtures for the GOO portfolio video.
//
// Every product below is a real item from GOO's live catalogue (export of
// /api/products, 2026-10-12): name, brand, category, price and photo backdrop
// are copied as they were. The photos were copied once from GOO's own image
// storage into public/fixtures/products/ (owner-approved, D1 in STORYBOARD.md),
// so the render runs fully offline. Prices are the catalogue's USD figures.
//
// Field shapes follow the app's Product type (src/vendor/lib/types.ts).
import { staticFile } from "remotion";
import type { Product, Retailer } from "@/lib/types";

const photo = (file: string) => staticFile(`fixtures/products/${file}.webp`);

function product(p: Omit<Product, "imageUrl" | "images" | "isSaved" | "styleKeywords" | "sizes" | "currency"> & { photos: string[] }): Product {
  const { photos, ...rest } = p;
  const images = photos.map(photo);
  return { ...rest, imageUrl: images[0], images, sizes: [], currency: "USD", isSaved: false, styleKeywords: [] };
}

export const leatherJacket = product({
  id: "purple-brand-leather-zip-jacket",
  name: "Leather Zip Jacket",
  brand: "Purple Brand" as Product["brand"],
  category: "outerwear" as Product["category"],
  subcategory: "Jackets",
  description: "Fall Winter 2026 Black Label 100% Lambskin Relaxed Fit Soft Lambskin On Seam Waist Pocket Leather Debossed Patch at Center Back Leather Embo",
  photos: ["purple-brand-leather-zip-jacket"],
  colors: ["Black"],
  material: "100% Lambskin",
  retailers: [{"name": "Purple Brand", "url": "#", "price": 970, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 970,
  priceMax: 970,
  isNew: false,
  bgColor: "#ffffff",
});

export const zutAlorsTee = product({
  id: "purple-brand-zut-alors-tee",
  name: "Zut Alors Tee",
  brand: "Purple Brand" as Product["brand"],
  category: "tops" as Product["category"],
  subcategory: "T-Shirts",
  description: "Pre Fall 2026 White Label 100% Cotton Regular Fit Textured Jersey Heavy Acid Wash Screen & Digital Print Raised Matte Silicone & Distressing",
  photos: ["purple-brand-zut-alors-tee"],
  colors: ["Black"],
  material: "100% cotton",
  retailers: [{"name": "Purple Brand", "url": "#", "price": 175, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 175,
  priceMax: 175,
  isNew: false,
  bgColor: "#ffffff",
});

export const hamptonJean = product({
  id: "ralph-lauren-hampton-jean",
  name: "Hampton Rigid Denim Jean 'Munroe'",
  brand: "Polo Ralph Lauren" as Product["brand"],
  category: "jeans" as Product["category"],
  subcategory: "Jeans",
  description: "Pre-verified and ready to ship with priority processing",
  photos: ["ralph-lauren-hampton-jean"],
  colors: ["Munroe"],
  material: "",
  retailers: [{"name": "Goat", "url": "#", "price": 191.85, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 191.85,
  priceMax: 191.85,
  isNew: false,
  bgColor: "#ffffff",
});

export const aj1Royal = product({
  id: "air-jordan-1-royal",
  name: "Air Jordan 1 Retro High OG 'Royal' 2026",
  brand: "Air Jordan" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Sneakers",
  description: "Pre-verified and ready to ship with priority processing",
  photos: ["air-jordan-1-royal", "air-jordan-1-royal-2", "air-jordan-1-royal-3", "air-jordan-1-royal-4"],
  colors: ["Blue"],
  material: "",
  retailers: [{"name": "Goat", "url": "#", "price": 148.37, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 148.37,
  priceMax: 148.37,
  isNew: true,
  bgColor: "#ffffff",
});

export const dailyPilotSunglasses = product({
  id: "balenciaga-daily-pilot-sunglasses",
  name: "Men's Daily Pilot Sunglasses in Light Grey",
  brand: "Balenciaga" as Product["brand"],
  category: "accessories" as Product["category"],
  subcategory: "Sunglasses",
  description: "Daily Pilot Sunglasses in transparent light grey Eastman Acetate Renew, an acetate alternative partially made of bio-based and recycled cont",
  photos: ["balenciaga-daily-pilot-sunglasses"],
  colors: ["Light Grey"],
  material: "",
  retailers: [{"name": "Balenciaga", "url": "#", "price": 255, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 255,
  priceMax: 255,
  isNew: false,
  bgColor: "#f7f5f4",
});

export const stoneStreetBoot = product({
  id: "timberland-stone-street-platform",
  name: "Women's Stone Street 6-Inch Waterproof Platform Boot",
  brand: "Timberland" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Boots",
  description: "A take on our classic boots, the Stone Street 6-inch Waterproof Platform Boot is made with Premium Timberland® leather and a ReBOTL™ fabric ",
  photos: ["timberland-stone-street-platform"],
  colors: ["Jet Black"],
  material: "",
  retailers: [{"name": "Timberland", "url": "#", "price": 190, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 190,
  priceMax: 190,
  isNew: true,
  bgColor: "#f2f2f2",
});

export const aj8Chrome = product({
  id: "air-jordan-8-chrome",
  name: "Air Jordan 8 Retro 'Chrome' 2026",
  brand: "Air Jordan" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Sneakers",
  description: "Items are new and unworn, but have imperfections that require you to review photos before purchasing.",
  photos: ["air-jordan-8-chrome"],
  colors: ["Black"],
  material: "",
  retailers: [{"name": "Goat", "url": "#", "price": 237.94, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 237.94,
  priceMax: 237.94,
  isNew: false,
  bgColor: "#ffffff",
});

export const combatStrikeBoots = product({
  id: "balenciaga-combat-strike-boots",
  name: "Brown Combat Strike Boots",
  brand: "Balenciaga" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Boots",
  description: "Ankle-high canvas boots.",
  photos: ["balenciaga-combat-strike-boots"],
  colors: ["Dark Brown"],
  material: "",
  retailers: [{"name": "SSENSE", "url": "#", "price": 1490.3, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 1490.3,
  priceMax: 1490.3,
  isNew: true,
  bgColor: "#ffffff",
});

export const pwWaterMoc = product({
  id: "adidas-pw-water-moc-blue",
  name: "Blue PW Water Moc Sneakers",
  brand: "adidas Originals" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Sneakers",
  description: "Low-top paneled mesh and canvas sneakers. · Perforations throughout · Hook-eye fastening at bungee-style closure · Logo bonded at vamp · Pul",
  photos: ["adidas-pw-water-moc-blue"],
  colors: ["Blue"],
  material: "",
  retailers: [{"name": "SSENSE", "url": "#", "price": 184.89, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 184.89,
  priceMax: 184.89,
  isNew: true,
  bgColor: "#ffffff",
});

export const astonSneakers = product({
  id: "tom-ford-aston-sneakers",
  name: "Burgundy Suede Aston Sneakers",
  brand: "TOM FORD" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Sneakers",
  description: "Low-top calfskin suede sneakers.",
  photos: ["tom-ford-aston-sneakers"],
  colors: ["Purple grass/Amber"],
  material: "calfskin suede",
  retailers: [{"name": "SSENSE", "url": "#", "price": 952.51, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 952.51,
  priceMax: 952.51,
  isNew: true,
  bgColor: "#ffffff",
});

export const aj14ForestGreen = product({
  id: "air-jordan-14-forest-green",
  name: "Air Jordan 14 Retro 'Forest Green'",
  brand: "Air Jordan" as Product["brand"],
  category: "footwear" as Product["category"],
  subcategory: "Sneakers",
  description: "Verified before shipping to you",
  photos: ["air-jordan-14-forest-green"],
  colors: ["White/Black/Dark Forest/Light Graphite"],
  material: "",
  retailers: [{"name": "Goat", "url": "#", "price": 346.3, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 346.3,
  priceMax: 346.3,
  isNew: true,
  bgColor: "#ffffff",
});

export const ninoJacket = product({
  id: "maniere-de-voir-nino-jacket",
  name: "Nino clasp-detail stitch jacket",
  brand: "Manière De Voir" as Product["brand"],
  category: "outerwear" as Product["category"],
  subcategory: "Jackets",
  description: "",
  photos: ["maniere-de-voir-nino-jacket"],
  colors: ["Black"],
  material: "",
  retailers: [{"name": "Farfetch", "url": "#", "price": 295, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 295,
  priceMax: 295,
  isNew: false,
  bgColor: "#ffffff",
});

export const y3UtilityVest = product({
  id: "y3-tactical-utility-vest",
  name: "Y-3 Tactical Utility vest",
  brand: "Y-3" as Product["brand"],
  category: "outerwear" as Product["category"],
  subcategory: "Vests",
  description: "",
  photos: ["y3-tactical-utility-vest"],
  colors: ["Black"],
  material: "",
  retailers: [{"name": "Farfetch", "url": "#", "price": 330, "currency": "USD", "availability": "in stock", "isOfficial": false} as Retailer],
  priceMin: 330,
  priceMax: 330,
  isNew: false,
  bgColor: "#ffffff",
});

export const reversiblePuffer = product({
  id: "project-gr-reversible-puffer",
  name: "Black Project G/R Army Reversible Hooded Puffer Jacket",
  brand: "PROJECT G/R" as Product["brand"],
  category: "outerwear" as Product["category"],
  subcategory: "Puffers",
  description: "Get the Army Reversible Hooded Puffer Jacket for a bold, refreshed look. Durable design and high-end finishes make this a collection essenti",
  photos: ["project-gr-reversible-puffer"],
  colors: ["Black"],
  material: "Cotton/Polyester",
  retailers: [{"name": "PROJECT G/R", "url": "#", "price": 300, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 300,
  priceMax: 300,
  isNew: false,
});

export const trackJacket = product({
  id: "yori-dirty-wash-track-jacket",
  name: "Dirty Wash Logo 5-Stripe Track Jacket",
  brand: "Yori" as Product["brand"],
  category: "outerwear" as Product["category"],
  subcategory: "Track Jackets",
  description: "\"Dirty\" wash  5 stripes from neckline to cuff 5 stripe zipper pull tab Embroidered Yori Sport logo \"77\" logo screen printed on back 100% Pol",
  photos: ["yori-dirty-wash-track-jacket"],
  colors: ["White"],
  material: "100% Polyester",
  retailers: [{"name": "Yori", "url": "#", "price": 117.92, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 117.92,
  priceMax: 117.92,
  isNew: false,
  bgColor: "#ffffff",
});

export const croppedJacket = product({
  id: "balenciaga-cropped-jacket",
  name: "Women's Cropped Jacket in Black",
  brand: "Balenciaga" as Product["brand"],
  category: "outerwear" as Product["category"],
  subcategory: "Jackets",
  description: "Cropped Jacket in black starch regenerative wool twill",
  photos: ["balenciaga-cropped-jacket"],
  colors: ["Black"],
  material: "starch regenerative wool twill",
  retailers: [{"name": "Balenciaga", "url": "#", "price": 2500, "currency": "USD", "availability": "in stock", "isOfficial": true} as Retailer],
  priceMin: 2500,
  priceMax: 2500,
  isNew: false,
  bgColor: "#f6f5f3",
});
