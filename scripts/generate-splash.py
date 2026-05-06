"""
iOS apple-touch-startup-image generator (Pillow version).

Renders all 15 portrait splash sizes referenced by index.html using the
Edullent brand mark on the manifest theme color.

Usage: `python scripts/generate-splash.py` (run from parent-dashboard/)
"""
import os
from PIL import Image

BG = (11, 31, 58)  # #0B1F3A — must stay in sync with manifest theme_color
SRC = "public/edullent-icon.png"
OUT_DIR = "public/splash"

src = Image.open(SRC).convert("RGBA")
bbox = src.getbbox()
cropped = src.crop(bbox)
w, h = cropped.size
side = max(w, h)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(cropped, ((side - w) // 2, (side - h) // 2))

splash_sizes = [
    (640, 1136), (750, 1334), (828, 1792),
    (1125, 2436), (1170, 2532), (1179, 2556),
    (1242, 2208), (1242, 2688), (1284, 2778), (1290, 2796),
    (1536, 2048), (1620, 2160), (1668, 2224), (1668, 2388), (2048, 2732),
]

os.makedirs(OUT_DIR, exist_ok=True)
for (w, h) in splash_sizes:
    canvas = Image.new("RGB", (w, h), BG)
    logo_size = int(min(w, h) * 0.22)
    fg = square.resize((logo_size, logo_size), Image.LANCZOS)
    canvas.paste(fg, ((w - logo_size) // 2, (h - logo_size) // 2), fg)
    canvas.save(f"{OUT_DIR}/apple-splash-{w}x{h}.png", "PNG", optimize=True)
    print(f"OK {w}x{h}")
print("Done")
