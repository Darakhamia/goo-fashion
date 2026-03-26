#!/usr/bin/env python3
"""
normalize_image.py — Автоматическая нормализация изображений товаров.

Использование:
  python3 scripts/normalize_image.py input.jpg output.jpg [--size 2400] [--fill 0.80]

Зависимости:
  pip install pillow opencv-python-headless numpy

Что делает:
  1. Проверяет минимальное разрешение (по умолчанию 1200px по короткой стороне).
  2. Обнаруживает границы товара на светлом фоне (Otsu threshold + контуры).
  3. Вырезает область товара, добавляет отступы до квадрата.
  4. Масштабирует так, чтобы товар занимал fill% площади.
  5. Сохраняет результат: квадрат size×size пикселей.
"""

import sys
import json
import argparse
from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image

# ── Константы ──────────────────────────────────────────────────────────────────
MIN_RESOLUTION = 1200       # мин. пикселей по короткой стороне
DEFAULT_TARGET  = 2400      # итоговый квадрат
DEFAULT_FILL    = 0.80      # товар занимает 80% площади
PADDING_RATIO   = 0.02      # дополнительный отступ вокруг bbox (2% от макс. стороны)
BG_COLOR        = (255, 255, 255)


@dataclass
class Result:
    success: bool
    output_path: Optional[str] = None
    error: Optional[str] = None
    original_size: Optional[Tuple[int, int]] = None
    detected_bbox: Optional[Tuple[int, int, int, int]] = None


def normalize(
    input_path: str,
    output_path: str,
    target_size: int = DEFAULT_TARGET,
    fill: float = DEFAULT_FILL,
) -> Result:
    # ── 1. Загрузка ──────────────────────────────────────────────────────────
    try:
        pil = Image.open(input_path).convert("RGB")
    except Exception as e:
        return Result(success=False, error=f"Не удалось открыть файл: {e}")

    orig_w, orig_h = pil.size

    # ── 2. Проверка разрешения ───────────────────────────────────────────────
    if min(orig_w, orig_h) < MIN_RESOLUTION:
        return Result(
            success=False,
            original_size=(orig_w, orig_h),
            error=(
                f"Разрешение слишком низкое: {orig_w}×{orig_h}px. "
                f"Минимально допустимое: {MIN_RESOLUTION}px по короткой стороне. "
                f"Загрузите изображение с более высоким разрешением."
            ),
        )

    # ── 3. Обнаружение товара ────────────────────────────────────────────────
    cv_img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    bbox = _detect_bbox(cv_img)
    if bbox is None:
        bbox = (0, 0, orig_w, orig_h)   # фоллбэк — весь кадр

    x, y, w, h = bbox

    # ── 4. Масштаб и кадрирование ────────────────────────────────────────────
    obj_target = int(target_size * fill)
    scale = obj_target / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)

    crop = pil.crop((x, y, x + w, y + h))
    crop = crop.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (target_size, target_size), BG_COLOR)
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    canvas.paste(crop, (offset_x, offset_y))

    # ── 5. Сохранение ────────────────────────────────────────────────────────
    try:
        canvas.save(output_path, "JPEG", quality=92, optimize=True)
    except Exception as e:
        return Result(success=False, error=f"Ошибка записи файла: {e}")

    return Result(
        success=True,
        output_path=output_path,
        original_size=(orig_w, orig_h),
        detected_bbox=bbox,
    )


def _detect_bbox(img_cv: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Обнаружение bounding box товара на светлом (белом/серым) фоне.

    Алгоритм:
      1. Grayscale + GaussianBlur (убирает JPEG-артефакты)
      2. Otsu threshold (авто-выбор порога светлый/тёмный)
      3. Morph Close + Open (закрываем дыры, убираем шум)
      4. Находим контуры, отфильтровываем мелкие (< 1% площади)
      5. Объединяем все значимые контуры в один bounding box
      6. Добавляем небольшой паддинг, чтобы не обрезать края
    """
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    _, binary = cv2.threshold(
        blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    img_area = img_cv.shape[0] * img_cv.shape[1]
    significant = [c for c in contours if cv2.contourArea(c) > img_area * 0.01]
    if not significant:
        return None

    rects = [cv2.boundingRect(c) for c in significant]
    x_min = min(r[0] for r in rects)
    y_min = min(r[1] for r in rects)
    x_max = max(r[0] + r[2] for r in rects)
    y_max = max(r[1] + r[3] for r in rects)

    pad = int(max(img_cv.shape[:2]) * PADDING_RATIO)
    x = max(0, x_min - pad)
    y = max(0, y_min - pad)
    w = min(img_cv.shape[1] - x, (x_max - x_min) + pad * 2)
    h = min(img_cv.shape[0] - y, (y_max - y_min) + pad * 2)

    return (x, y, w, h)


# ── CLI ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize product image to square.")
    parser.add_argument("input",  help="Path to input image")
    parser.add_argument("output", help="Path to output JPEG")
    parser.add_argument("--size", type=int, default=DEFAULT_TARGET,
                        help=f"Output square size in px (default: {DEFAULT_TARGET})")
    parser.add_argument("--fill", type=float, default=DEFAULT_FILL,
                        help=f"Product fill ratio 0–1 (default: {DEFAULT_FILL})")
    parser.add_argument("--json", action="store_true",
                        help="Output result as JSON (for API integration)")
    args = parser.parse_args()

    result = normalize(args.input, args.output, args.size, args.fill)

    if args.json:
        print(json.dumps({
            "success":       result.success,
            "output_path":   result.output_path,
            "error":         result.error,
            "original_size": result.original_size,
            "detected_bbox": result.detected_bbox,
        }))
    else:
        if result.success:
            print(f"OK  →  {result.output_path}")
            print(f"       Оригинал: {result.original_size[0]}×{result.original_size[1]}px")
            print(f"       Bbox товара: x={result.detected_bbox[0]}, y={result.detected_bbox[1]}, "
                  f"w={result.detected_bbox[2]}, h={result.detected_bbox[3]}")
        else:
            print(f"ОШИБКА: {result.error}", file=sys.stderr)
            sys.exit(1)
