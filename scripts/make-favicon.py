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
  2. Рисует «GOO» белым на фирменном #0a0a0a в квадрате со скруглёнными углами.
  3. Пишет src/app/favicon.ico (16/32/48/64/128/256), icon.png и apple-icon.png.

Пропорции букв везде родные — «GOO» нигде не сужается, иначе логотип выглядит
сплющенным. Каждый кадр .ico рисуется отдельно под свой размер, а не ужимается
из одного мастера: на мелких отступ чуть меньше и добавлена резкость, чтобы
просветы внутри G/O/O не затекали. Это равномерный масштаб, а не искажение
пропорций; к 64px коррекция сходит на нет.
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

RADIUS = 0.28  # радиус скругления в долях стороны
PAD = 0.14     # поля вокруг вордмарка в долях стороны

APP_DIR = pathlib.Path(__file__).resolve().parent.parent / "src" / "app"

# размер -> (отступ, резкость); на мелких кадрах чуть теснее и резче ради читаемости
SPEC = {
    16: (0.10, 2.0),
    32: (0.12, 1.4),
    48: (PAD, 1.15),
    64: (PAD, 1.0),
    128: (PAD, 1.0),
    256: (PAD, 1.0),
}


def load_font_bytes() -> bytes:
    with urllib.request.urlopen(FONT_URL) as resp:
        return resp.read()


def render(font_bytes: bytes, size: int, pad: float = PAD, radius: float = RADIUS,
           sharpen: float = 1.0, ss: int = 16) -> Image.Image:
    """Отрисовать иконку size×size со сглаживанием через суперсэмплинг."""
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if radius > 0:
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius), fill=BG)
    else:
        draw.rectangle([0, 0, s, s], fill=BG)

    target = s * (1 - 2 * pad)
    font_size = 10
    while draw.textlength(TEXT, font=ImageFont.truetype(io.BytesIO(font_bytes), font_size)) < target:
        font_size += max(1, int(font_size * 0.05))

    font = ImageFont.truetype(io.BytesIO(font_bytes), font_size)
    text_w = draw.textlength(TEXT, font=font)
    box = draw.textbbox((0, 0), TEXT, font=font)
    draw.text(((s - text_w) / 2, (s - (box[3] - box[1])) / 2 - box[1]),
              TEXT, font=font, fill=FG)

    out = img.resize((size, size), Image.LANCZOS)
    if sharpen != 1.0:
        # резкость применяем к цвету, альфу скругления сохраняем как есть
        alpha = out.getchannel("A")
        out = ImageEnhance.Sharpness(out).enhance(sharpen)
        out.putalpha(alpha)
    return out


def main() -> None:
    font_bytes = load_font_bytes()

    frames = [render(font_bytes, sz, pad=pad, sharpen=sh) for sz, (pad, sh) in SPEC.items()]
    frames[-1].save(APP_DIR / "favicon.ico", format="ICO",
                    sizes=[(s, s) for s in SPEC], append_images=frames[:-1])

    # экраны высокой плотности и PWA
    render(font_bytes, 512).save(APP_DIR / "icon.png", optimize=True)
    # iOS скругляет углы сам — свои не рисуем, иначе получится двойное скругление
    render(font_bytes, 180, radius=0).save(APP_DIR / "apple-icon.png", optimize=True)

    for name in ("favicon.ico", "icon.png", "apple-icon.png"):
        path = APP_DIR / name
        print(f"{name:16} {path.stat().st_size:>8,} bytes")


if __name__ == "__main__":
    main()
