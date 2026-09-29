/**
 * The style a brand stands for, when a product's own words say nothing.
 *
 * A brand is built around a manner: Adidas makes sportswear, Gucci dresses
 * people for the office and the evening, Supreme for the street. The importer
 * reads a piece's style from its description first (`taxonomy/styles`); this
 * is what it falls back on — or mixes in, when the description names a single
 * style — as the CEO set the order on 2026-09-29: the description leads, the
 * brand follows (`proposeStyles` in `server/catalogue-profile`).
 *
 * One style per brand, the one the brand is known for. A brand's line that
 * stands apart gets its own entry, and the longest matching entry wins:
 * "Carhartt WIP" is streetwear although Carhartt is casual, "Brooks Brothers"
 * classic although Brooks is running.
 *
 * ── Matching ── brands are compared by their letters and digits only,
 * lowercase, accents dropped: "Stüssy", "STUSSY" and "Stussy" are one brand,
 * "Levi's" is "levis", "Gallery Dept." is "gallerydept". An entry matches a
 * brand that starts with it, so a collaboration or a sub-line is covered
 * ("Nike x Sacai", "adidas Originals"). An entry ending in "!" matches only
 * the whole brand: short or common names that begin other brands ("On",
 * "Jordan" — Jordan Luca is a tailor — "Gap", "Lee").
 */
import type { StyleKeyword } from "@/lib/types";

export const BRAND_STYLES: Record<StyleKeyword, readonly string[]> = {
  casual: [
    "Zara", "H&M", "HM!", "Gap!", "Levi's", "Levis", "Levi Strauss", "Lee!", "Wrangler", "Mango",
    "Pull&Bear", "Bershka", "Stradivarius", "Uniqlo", "Abercrombie", "Hollister", "American Eagle",
    "Tommy Hilfiger", "Tommy Jeans", "Calvin Klein Jeans", "Fred Perry", "Carhartt", "Converse",
    "Dr. Martens", "Doc Martens", "Timberland", "Clarks", "Birkenstock", "Crocs", "UGG!", "Superdry",
    "Jack & Jones", "Only!", "Reserved!", "Diesel", "G-Star", "Pepe Jeans", "Guess", "Napapijri",
    "Patagonia", "Aimé Leon Dore", "J.Crew", "Banana Republic", "Old Navy", "Weekday!", "Monki",
    "New Look", "River Island", "Topshop", "ASOS", "Urban Outfitters", "Scotch & Soda", "Marc O'Polo",
    "s.Oliver", "Tom Tailor", "Esprit", "Benetton", "United Colors of Benetton",
  ],
  minimal: [
    "COS!", "Arket", "Jil Sander", "The Row", "Toteme", "Lemaire", "A.P.C.", "APC!", "Acne Studios",
    "Our Legacy", "Studio Nicholson", "Filippa K", "Everlane", "Maison Margiela", "Auralee",
    "Norse Projects", "Sunspel", "Asket!", "Common Projects", "Axel Arigato", "Samsøe Samsøe",
    "Muji", "Calvin Klein", "Theory!", "Vince!", "Khaite", "Aesther Ekme", "Rains!", "Hope!",
  ],
  classic: [
    "Gucci", "Prada", "Hugo Boss", "Boss!", "Ralph Lauren", "Polo Ralph Lauren", "Brunello Cucinelli",
    "Loro Piana", "Zegna", "Ermenegildo Zegna", "Brioni", "Kiton", "Canali", "Corneliani", "Tom Ford",
    "Giorgio Armani", "Emporio Armani", "Armani", "Burberry", "Dior", "Christian Dior", "Louis Vuitton",
    "Hermès", "Chanel", "Saint Laurent", "Yves Saint Laurent", "YSL!", "Celine", "Givenchy", "Valentino",
    "Versace", "Dolce & Gabbana", "Salvatore Ferragamo", "Ferragamo", "Tod's", "Tods!", "Church's",
    "Crockett & Jones", "John Lobb", "Berluti", "Brooks Brothers", "Massimo Dutti", "Reiss", "Ted Baker",
    "Suitsupply", "Charles Tyrwhitt", "Paul Smith", "Max Mara", "Loewe", "Bottega Veneta", "Fendi",
    "Bally!", "Barbour", "Aquascutum", "Gieves & Hawkes", "Dunhill", "Alfred Dunhill", "Boglioli",
    "Lardini", "Lanvin", "Lacoste", "Sandro", "Maje!", "Hackett", "Eton!", "Turnbull & Asser", "Isaia",
    "Etro!", "Miu Miu", "Balmain", "Alexander McQueen", "Jimmy Choo", "Manolo Blahnik",
    "Christian Louboutin", "Louboutin",
  ],
  streetwear: [
    "Supreme", "Palace", "Stüssy", "Bape", "A Bathing Ape", "Aape!", "Kith", "Corteiz", "Trapstar",
    "Represent", "Hellstar", "Gallery Dept", "VLONE", "Sp5der", "Chrome Hearts", "Off-White",
    "Fear of God", "Essentials!", "Denim Tears", "Broken Planet", "Cole Buxton", "Minus Two",
    "Syna World", "Hoodrich", "Palm Angels", "Amiri", "Rhude", "Heron Preston", "Ambush!",
    "Neighborhood", "Wtaps", "Human Made", "Billionaire Boys Club", "Ksubi", "Balenciaga", "Vetements",
    "Stone Island", "C.P. Company", "CP Company", "Carhartt WIP", "Dickies", "Vans", "Etnies",
    "DC Shoes", "DC!", "Element!", "Obey!", "HUF!", "Thrasher", "Anti Social Social Club", "Nike SB",
    "Diamond Supply", "Evisu", "Yeezy", "Mowalola", "Purple Brand", "Cav Empt", "Aries!", "Awake NY",
  ],
  sporty: [
    "Adidas", "Nike", "Air Jordan", "Jordan!", "Jordan Brand", "Puma", "Reebok", "New Balance", "Asics",
    "Under Armour", "Lululemon", "Alo Yoga", "Alo!", "Gymshark", "Fila", "Umbro", "Kappa!", "Champion!",
    "Ellesse", "Mizuno", "Saucony", "Brooks!", "Brooks Running", "Hoka", "On!", "On Running", "Salomon",
    "Diadora", "Le Coq Sportif", "Lotto!", "Sergio Tacchini", "Russell Athletic", "Oakley", "Rapha!",
    "Castelli", "Speedo", "Arena!", "Wilson!", "Babolat", "Yonex", "Peak Performance", "Descente",
    "The North Face", "North Face", "Arc'teryx", "Columbia", "Mammut", "Haglöfs", "Montbell", "Y-3",
    "Y3!", "Satisfy!", "Tracksmith", "Castore", "Adanola", "Moncler Grenoble",
  ],
};

/** Letters and digits only, lowercase, accents dropped. */
function compact(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

interface Entry {
  key: string;
  exact: boolean;
  style: StyleKeyword;
  /** As written in the list, for the note saying why. */
  name: string;
}

/** Longest first, so the most specific line of a brand is the one that answers. */
const ENTRIES: Entry[] = (Object.entries(BRAND_STYLES) as [StyleKeyword, readonly string[]][])
  .flatMap(([style, brands]) =>
    brands.map((raw) => {
      const exact = raw.endsWith("!");
      const name = exact ? raw.slice(0, -1) : raw;
      return { key: compact(name), exact, style, name };
    }),
  )
  .filter((e) => e.key)
  .sort((a, b) => b.key.length - a.key.length);

/** The style `brand` is known for, and the entry that said so; undefined for a brand not in the list. */
export function brandStyle(brand: string): { style: StyleKeyword; entry: string } | undefined {
  const key = compact(brand);
  if (!key) return undefined;
  const hit = ENTRIES.find((e) => (e.exact ? key === e.key : key.startsWith(e.key)));
  return hit ? { style: hit.style, entry: hit.name } : undefined;
}
