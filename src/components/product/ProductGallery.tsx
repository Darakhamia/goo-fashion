"use client";

import { useState, useEffect, useMemo } from "react";

interface ProductGalleryProps {
  images: string[];
  colors: string[];
  colorImages?: Record<string, string[]>;
  productName: string;
  isNew: boolean;
}

export default function ProductGallery({
  images,
  colors,
  colorImages,
  productName,
  isNew,
}: ProductGalleryProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Pick images for the active color, fall back to general images
  const displayImages = useMemo(() => {
    if (selectedColor && colorImages?.[selectedColor]?.length) {
      return colorImages[selectedColor];
    }
    return images.filter(Boolean);
  }, [selectedColor, colorImages, images]);

  // Reset to first image whenever the color changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(0);
  }, [selectedColor]);

  const mainImage = displayImages[activeIdx] || images[0] || "";

  const handleColorClick = (color: string) => {
    setSelectedColor((prev) => (prev === color ? null : color));
  };

  return (
    <>
      {/* ── Main image ── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface)]">
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainImage}
            alt={productName}
            className="w-full h-full object-cover transition-opacity duration-300"
            key={mainImage}
          />
        ) : (
          <div className="w-full h-full bg-[var(--surface)]" />
        )}
        {isNew && (
          <div className="absolute top-4 left-4">
            <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-3 py-1.5 block">
              New
            </span>
          </div>
        )}
        {/* Color label overlay */}
        {selectedColor && (
          <div className="absolute bottom-4 left-4">
            <span className="text-[9px] tracking-[0.12em] uppercase bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2.5 py-1.5 block">
              {selectedColor}
            </span>
          </div>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {displayImages.length > 1 && (
        <div className="flex gap-px mt-px">
          {displayImages.map((img, i) => (
            <button
              key={`${img}-${i}`}
              onClick={() => setActiveIdx(i)}
              className={`flex-1 relative aspect-square overflow-hidden transition-all duration-150 ${
                i === activeIdx
                  ? "ring-1 ring-inset ring-[var(--foreground)]"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={`${productName} view ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* ── Color selector ── */}
      {colors.length > 0 && (
        <div className="mt-5 px-0">
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
            Available in
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const hasImages =
                colorImages?.[color] && colorImages[color].length > 0;
              return (
                <button
                  key={color}
                  onClick={() => handleColorClick(color)}
                  className={`relative text-xs border px-3 py-1.5 transition-colors duration-200 ${
                    selectedColor === color
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {color}
                  {/* Dot indicator if this color has specific images */}
                  {hasImages && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />
                  )}
                </button>
              );
            })}
          </div>
          {selectedColor && colorImages?.[selectedColor]?.length && (
            <p className="text-[10px] text-[var(--foreground-subtle)] mt-2">
              Showing {colorImages[selectedColor].length} photo{colorImages[selectedColor].length > 1 ? "s" : ""} for {selectedColor}
            </p>
          )}
        </div>
      )}
    </>
  );
}
