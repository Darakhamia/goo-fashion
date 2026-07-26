#!/usr/bin/env python3
"""
make-favicon.py — Генерация иконок вкладки из вордмарка GOO.

Использование:
  python3 scripts/make-favicon.py

Зависимости:
  pip install pillow

Что делает:
  1. Скачивает Poppins ExtraBold — тот же шрифт, которым набран логотип
     в шапке (см. Navigation.tsx, --font-poppins, weight 800).
  2. Рисует «GOO» белым на фирменном #0a0a0a почти во всю ширину квадрата.
  3. Пишет src/app/favicon.ico (16/32/48/64/128/256), icon.png и apple-icon.png.

Каждый кадр .ico рисуется отдельно под свой размер, а не ужимается из одного
мастера. «GOO» втрое шире одной буквы, поэтому в квадрате высота букв выходит
небольшой, и на 16px честные пропорции превращаются в кашу. Мелкие кадры
поэтому слегка сужены и подшарплены, чтобы просветы внутри G/O/O не
затекали; к 64px эта коррекция сходит на нет.
"""

import io
import pathlib
import urllib.request

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

# Poppins ExtraBold с Google Fonts — шрифт логотипа в шапке.
FONT_URL = "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLDD4V1s.ttf"

BG = (10, 10, 10, 255)  # тот же чёрный, что и фон сайта
FG = (255, 255, 255, 255)
TEXT = "GOO"

APP_DIR = pathlib.Path(__file__).resolve().parent.parent / "src" / "app"

# размер -> (отступ, сужение, резкость); коррекция слабеет по мере роста пикселей
SPEC = {
    16: (0.02, 0.80, 2.2),
    32: (0.04, 0.90, 1.5),
    48: (0.05, 0.96, 1.2),
    64: (0.06, 1.00, 1.0),
    128: (0.06, 1.00, 1.0),
    256: (0.06, 1.00, 1.0),
}


def load_font_bytes() -> bytes:
    with urllib.request.urlopen(FONT_URL) as resp:
        return resp.read()


def render(font_bytes: bytes, size: int, pad: float,
           condense: float = 1.0, sharpen: float = 1.0, ss: int = 16) -> Image.Image:
    """Отрисовать иконку size×size со сглаживанием через суперсэмплинг."""
    s = size * ss
    # рисуем шире и потом сжимаем по горизонтали — так буквы выходят выше
    width = int(s / condense)
    img = Image.new("RGBA", (width, s), BG)
    draw = ImageDraw.Draw(img)

    target = s * (1 - 2 * pad) / condense
    font_size = 10
    while draw.textlength(TEXT, font=ImageFont.truetype(io.BytesIO(font_bytes), font_size)) < target:
        font_size += max(1, int(font_size * 0.06))

    font = ImageFont.truetype(io.BytesIO(font_bytes), font_size)
    text_w = draw.textlength(TEXT, font=font)
    box = draw.textbbox((0, 0), TEXT, font=font)
    draw.text(((width - text_w) / 2, (s - (box[3] - box[1])) / 2 - box[1]),
              TEXT, font=font, fill=FG)

    out = img.resize((size, size), Image.LANCZOS)
    if sharpen != 1.0:
        out = ImageEnhance.Sharpness(out).enhance(sharpen)
        out = ImageEnhance.Contrast(out).enhance(1.15)
    return out


def main() -> None:
    font_bytes = load_font_bytes()

    frames = [render(font_bytes, sz, *SPEC[sz]) for sz in SPEC]
    frames[-1].save(APP_DIR / "favicon.ico", format="ICO",
                    sizes=[(s, s) for s in SPEC], append_images=frames[:-1])

    # экраны высокой плотности и PWA
    render(font_bytes, 512, 0.06).save(APP_DIR / "icon.png", optimize=True)
    # iOS скругляет углы сам, поэтому отступ побольше
    render(font_bytes, 180, 0.10).save(APP_DIR / "apple-icon.png", optimize=True)

    for name in ("favicon.ico", "icon.png", "apple-icon.png"):
        path = APP_DIR / name
        print(f"{name:16} {path.stat().st_size:>8,} bytes")


if __name__ == "__main__":
    main()
