"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CropData } from "@/lib/types";

interface Props {
  imageUrl: string;
  productName: string;
  initialCrop?: CropData;
  onSave: (crop: CropData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const DEFAULT_CROP: CropData = {
  x: 0.1,
  y: 0.1,
  width: 0.8,
  height: 0.8,
  focalX: 0.5,
  focalY: 0.5,
};

const ASPECT_RATIO = 3 / 4; // карточка товара 3:4

export function ImageCropEditor({
  imageUrl,
  productName,
  initialCrop,
  onSave,
  onCancel,
  saving = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<CropData>(initialCrop ?? DEFAULT_CROP);

  // Тип активного перетаскивания
  type DragKind = "move" | "focal" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se";
  const dragRef = useRef<{
    kind: DragKind;
    startMx: number;
    startMy: number;
    startCrop: CropData;
  } | null>(null);

  // Пересчёт координат мыши в относительные (0–1) внутри контейнера
  const toRel = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      rx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      ry: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const startDrag = (kind: DragKind, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const client = "touches" in e ? e.touches[0] : e;
    dragRef.current = {
      kind,
      startMx: client.clientX,
      startMy: client.clientY,
      startCrop: { ...crop },
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const { kind, startMx, startMy, startCrop } = dragRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      const client = "touches" in e ? (e as TouchEvent).touches[0] : (e as MouseEvent);
      const dx = (client.clientX - startMx) / rect.width;
      const dy = (client.clientY - startMy) / rect.height;

      setCrop((prev) => {
        if (kind === "move") {
          return {
            ...prev,
            x: clamp(startCrop.x + dx, 0, 1 - startCrop.width),
            y: clamp(startCrop.y + dy, 0, 1 - startCrop.height),
          };
        }

        if (kind === "focal") {
          const { rx, ry } = toRel(client.clientX, client.clientY);
          return {
            ...prev,
            focalX: clamp((rx - prev.x) / prev.width, 0, 1),
            focalY: clamp((ry - prev.y) / prev.height, 0, 1),
          };
        }

        // Resize handles — maintain aspect ratio 3:4
        let { x, y, width, height } = startCrop;

        if (kind === "resize-se") {
          width = clamp(startCrop.width + dx, 0.2, 1 - startCrop.x);
          height = width / ASPECT_RATIO;
          if (y + height > 1) { height = 1 - y; width = height * ASPECT_RATIO; }
        }
        if (kind === "resize-sw") {
          width = clamp(startCrop.width - dx, 0.2, startCrop.x + startCrop.width);
          height = width / ASPECT_RATIO;
          if (y + height > 1) { height = 1 - y; width = height * ASPECT_RATIO; }
          x = startCrop.x + startCrop.width - width;
        }
        if (kind === "resize-ne") {
          width = clamp(startCrop.width + dx, 0.2, 1 - startCrop.x);
          height = width / ASPECT_RATIO;
          y = startCrop.y + startCrop.height - height;
          if (y < 0) { y = 0; height = startCrop.y + startCrop.height; width = height * ASPECT_RATIO; }
        }
        if (kind === "resize-nw") {
          width = clamp(startCrop.width - dx, 0.2, startCrop.x + startCrop.width);
          height = width / ASPECT_RATIO;
          x = startCrop.x + startCrop.width - width;
          y = startCrop.y + startCrop.height - height;
          if (x < 0) { x = 0; width = startCrop.x + startCrop.width; height = width / ASPECT_RATIO; }
          if (y < 0) { y = 0; height = startCrop.y + startCrop.height; width = height * ASPECT_RATIO; x = startCrop.x + startCrop.width - width; }
        }

        return { ...prev, x, y, width, height };
      });
    };

    const onUp = () => { dragRef.current = null; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [toRel]);

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  // Точка фокуса в абсолютных координатах контейнера
  const focalAbsX = crop.x + crop.focalX * crop.width;
  const focalAbsY = crop.y + crop.focalY * crop.height;

  const handleReset = () => setCrop(DEFAULT_CROP);

  return (
    <div className="flex flex-col gap-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)]">Редактор кадрирования</h3>
          <p className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">{productName}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline transition-colors"
        >
          Сбросить
        </button>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-4 text-[10px] text-[var(--foreground-subtle)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border-2 border-white bg-transparent" />
          Рамка — перетащи
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-yellow-400 bg-yellow-400/30" />
          Фокус — перетащи
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 bg-white opacity-80" />
          Углы — масштаб
        </span>
      </div>

      {/* Холст */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden bg-[var(--surface)] border border-[var(--border)]"
        style={{ aspectRatio: "1 / 1" }}
      >
        {/* Оригинальное изображение */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={productName}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* Затемнение снаружи рамки */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              linear-gradient(to right, rgba(0,0,0,0.55) ${pct(crop.x)}, transparent ${pct(crop.x)}),
              linear-gradient(to left, rgba(0,0,0,0.55) ${pct(1 - crop.x - crop.width)}, transparent ${pct(1 - crop.x - crop.width)}),
              linear-gradient(to bottom, rgba(0,0,0,0.55) ${pct(crop.y)}, transparent ${pct(crop.y)}),
              linear-gradient(to top, rgba(0,0,0,0.55) ${pct(1 - crop.y - crop.height)}, transparent ${pct(1 - crop.y - crop.height)})
            `,
          }}
        />

        {/* Рамка кадрирования */}
        <div
          className="absolute border-2 border-white cursor-move touch-none"
          style={{
            left: pct(crop.x),
            top: pct(crop.y),
            width: pct(crop.width),
            height: pct(crop.height),
          }}
          onMouseDown={(e) => startDrag("move", e)}
          onTouchStart={(e) => startDrag("move", e)}
        >
          {/* Сетка правила третей */}
          {[1 / 3, 2 / 3].map((v) => (
            <span key={v}>
              <span
                className="absolute top-0 bottom-0 w-px bg-white/25 pointer-events-none"
                style={{ left: pct(v) }}
              />
              <span
                className="absolute left-0 right-0 h-px bg-white/25 pointer-events-none"
                style={{ top: pct(v) }}
              />
            </span>
          ))}

          {/* Угловые ручки resize */}
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              className={`absolute w-4 h-4 bg-white cursor-${corner}-resize touch-none z-10 ${
                corner === "nw" ? "-top-1 -left-1" :
                corner === "ne" ? "-top-1 -right-1" :
                corner === "sw" ? "-bottom-1 -left-1" :
                "-bottom-1 -right-1"
              }`}
              onMouseDown={(e) => startDrag(`resize-${corner}`, e)}
              onTouchStart={(e) => startDrag(`resize-${corner}`, e)}
            />
          ))}
        </div>

        {/* Точка фокуса */}
        <div
          className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none z-20"
          style={{ left: pct(focalAbsX), top: pct(focalAbsY) }}
          onMouseDown={(e) => startDrag("focal", e)}
          onTouchStart={(e) => startDrag("focal", e)}
        >
          <div className="w-full h-full rounded-full border-2 border-yellow-400 bg-yellow-400/30" />
          <div className="absolute inset-0 flex items-center justify-center text-yellow-400 text-[10px] font-bold leading-none">
            +
          </div>
        </div>
      </div>

      {/* Числовые значения + предпросмотр */}
      <div className="flex items-start gap-4">
        {/* Предпросмотр в соотношении 3:4 */}
        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-[0.1em]">Preview 3:4</span>
          <div
            className="overflow-hidden bg-[var(--surface)] border border-[var(--border)]"
            style={{ width: 60, height: 80 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="preview"
              style={{
                position: "relative",
                width: `${100 / crop.width}%`,
                height: `${100 / crop.height}%`,
                top: `${(-crop.y / crop.height) * 100}%`,
                left: `${(-crop.x / crop.width) * 100}%`,
                objectFit: "cover",
              }}
            />
          </div>
        </div>

        {/* Координаты */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[var(--foreground-muted)]">
          <span>X: <b className="text-[var(--foreground)]">{Math.round(crop.x * 100)}%</b></span>
          <span>Y: <b className="text-[var(--foreground)]">{Math.round(crop.y * 100)}%</b></span>
          <span>W: <b className="text-[var(--foreground)]">{Math.round(crop.width * 100)}%</b></span>
          <span>H: <b className="text-[var(--foreground)]">{Math.round(crop.height * 100)}%</b></span>
          <span>FX: <b className="text-[var(--foreground)]">{Math.round(crop.focalX * 100)}%</b></span>
          <span>FY: <b className="text-[var(--foreground)]">{Math.round(crop.focalY * 100)}%</b></span>
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(crop)}
          disabled={saving}
          className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-2.5 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {saving ? "Сохранение…" : "Сохранить кадрирование"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-[var(--border)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
