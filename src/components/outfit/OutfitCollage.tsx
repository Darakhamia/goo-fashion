import Image from "next/image";
import { Outfit } from "@/lib/types";

interface Props {
  outfit: Outfit;
  priority?: boolean;
  sizes?: string;
}

/**
 * Renders a collage of the outfit's product images.
 * Layouts:
 *  1 item  → single full image
 *  2 items → equal side-by-side split
 *  3 items → hero (55%) + two stacked on the right (45%)
 *  4 items → 2×2 grid
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

  const frames = sorted.slice(0, 4);
  const count = frames.length;

  const hueStyle = (f: (typeof frames)[number]) => {
    const h = f.hue ?? 0;
    return h !== 0 ? { filter: `hue-rotate(${h}deg)` } : undefined;
  };

  if (count === 1) {
    return (
      <div className="absolute inset-0">
        <Image
          src={frames[0].product.imageUrl}
          alt={frames[0].product.name}
          fill
          className="object-cover"
          style={hueStyle(frames[0])}
          priority={priority}
          sizes={sizes}
        />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="absolute inset-0 flex gap-px">
        {frames.map((f, i) => (
          <div key={i} className="relative overflow-hidden flex-1">
            <Image
              src={f.product.imageUrl}
              alt={f.product.name}
              fill
              className="object-cover"
              style={hueStyle(f)}
              priority={priority && i === 0}
              sizes={sizes}
            />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="absolute inset-0 flex gap-px">
        <div className="relative overflow-hidden" style={{ width: "55%" }}>
          <Image
            src={frames[0].product.imageUrl}
            alt={frames[0].product.name}
            fill
            className="object-cover"
            style={hueStyle(frames[0])}
            priority={priority}
            sizes={sizes}
          />
        </div>
        <div className="flex flex-col gap-px overflow-hidden" style={{ width: "45%" }}>
          {frames.slice(1).map((f, i) => (
            <div key={i} className="relative overflow-hidden flex-1">
              <Image
                src={f.product.imageUrl}
                alt={f.product.name}
                fill
                className="object-cover"
                style={hueStyle(f)}
                sizes={sizes}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4 items: 2×2 grid
  return (
    <div className="absolute inset-0 flex flex-col gap-px">
      <div className="flex gap-px flex-1">
        {frames.slice(0, 2).map((f, i) => (
          <div key={i} className="relative overflow-hidden flex-1">
            <Image
              src={f.product.imageUrl}
              alt={f.product.name}
              fill
              className="object-cover"
              style={hueStyle(f)}
              priority={priority && i === 0}
              sizes={sizes}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-px flex-1">
        {frames.slice(2).map((f, i) => (
          <div key={i} className="relative overflow-hidden flex-1">
            <Image
              src={f.product.imageUrl}
              alt={f.product.name}
              fill
              className="object-cover"
              style={hueStyle(f)}
              sizes={sizes}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
