import Image from "next/image";
import { Outfit, OutfitItem } from "@/lib/types";

interface Props {
  outfit: Outfit;
  priority?: boolean;
  sizes?: string;
}

function itemImageUrl(item: OutfitItem): string {
  if (item.selectedColor && item.product.colorImages?.[item.selectedColor]?.[0]) {
    return item.product.colorImages[item.selectedColor][0];
  }
  return item.product.imageUrl;
}

/**
 * Renders a collage of the outfit's product images.
 * Layouts by count:
 *  1 → full
 *  2 → 50/50 side by side
 *  3 → top 2 (60%) + bottom 1 wide (40%)
 *  4 → 2×2 grid
 *  5 → top 2 (57%) + bottom 3 (43%)
 *  6 → top 2 (40%) + mid 3 (33%) + bottom 1 wide (27%)
 */
export default function OutfitCollage({
  outfit,
  priority = false,
  sizes = "(max-width: 768px) 50vw, 25vw",
}: Props) {
  const sorted = [...outfit.items].sort((a, b) => {
    const order: Record<string, number> = { hero: 0, secondary: 1, accent: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3);
  });

  const frames = sorted.slice(0, 6);
  const n = frames.length;

  const cell = (f: OutfitItem, i: number, pad = "p-3") => (
    <div key={i} className="relative overflow-hidden flex-1 bg-white">
      <Image
        src={itemImageUrl(f)}
        alt={f.product.name}
        fill
        className={`object-contain ${pad}`}
        priority={priority && i === 0}
        sizes={sizes}
      />
    </div>
  );

  if (n === 1) {
    return (
      <div className="absolute inset-0 bg-white">
        <Image src={itemImageUrl(frames[0])} alt={frames[0].product.name} fill className="object-contain p-3" priority={priority} sizes={sizes} />
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="absolute inset-0 flex gap-px bg-white/20">
        {frames.map((f, i) => cell(f, i))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="absolute inset-0 flex flex-col gap-px bg-white/20">
        <div className="flex gap-px" style={{ flex: "0 0 60%" }}>
          {frames.slice(0, 2).map((f, i) => cell(f, i))}
        </div>
        <div className="relative overflow-hidden bg-white" style={{ flex: "0 0 40%" }}>
          <Image src={itemImageUrl(frames[2])} alt={frames[2].product.name} fill className="object-contain p-2" sizes={sizes} />
        </div>
      </div>
    );
  }

  if (n === 4) {
    return (
      <div className="absolute inset-0 flex flex-col gap-px bg-white/20">
        <div className="flex gap-px flex-1">
          {frames.slice(0, 2).map((f, i) => cell(f, i))}
        </div>
        <div className="flex gap-px flex-1">
          {frames.slice(2, 4).map((f, i) => cell(f, i + 2))}
        </div>
      </div>
    );
  }

  if (n === 5) {
    return (
      <div className="absolute inset-0 flex flex-col gap-px bg-white/20">
        <div className="flex gap-px" style={{ flex: "0 0 57%" }}>
          {frames.slice(0, 2).map((f, i) => cell(f, i))}
        </div>
        <div className="flex gap-px" style={{ flex: "0 0 43%" }}>
          {frames.slice(2, 5).map((f, i) => cell(f, i + 2, "p-2"))}
        </div>
      </div>
    );
  }

  // 6 pieces
  return (
    <div className="absolute inset-0 flex flex-col gap-px bg-white/20">
      <div className="flex gap-px" style={{ flex: "0 0 40%" }}>
        {frames.slice(0, 2).map((f, i) => cell(f, i))}
      </div>
      <div className="flex gap-px" style={{ flex: "0 0 33%" }}>
        {frames.slice(2, 5).map((f, i) => cell(f, i + 2, "p-2"))}
      </div>
      <div className="relative overflow-hidden bg-white" style={{ flex: "0 0 27%" }}>
        <Image src={itemImageUrl(frames[5])} alt={frames[5].product.name} fill className="object-contain p-2" sizes={sizes} />
      </div>
    </div>
  );
}
