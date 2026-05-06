"""
Edullent PWA icon generator (Pillow version).

Identical output to scripts/generate-icons.mjs but only requires Pillow,
which is already part of the user's Python toolchain.

Usage: `python scripts/generate-icons.py` (run from parent-dashboard/)
"""
import os
from PIL import Image

SRC = "public/edullent-icon.png"
OUT_DIR = "public/icons"
BRAND_BG = (32, 56, 108, 255)

src = Image.open(SRC).convert("RGBA")
bbox = src.getbbox()
cropped = src.crop(bbox)
w, h = cropped.size
side = max(w, h)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(cropped, ((side - w) // 2, (side - h) // 2))

os.makedirs(OUT_DIR, exist_ok=True)
sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]
for s in sizes:
    name = f"{OUT_DIR}/apple-touch-icon.png" if s == 180 else f"{OUT_DIR}/icon-{s}x{s}.png"
    square.resize((s, s), Image.LANCZOS).save(name, "PNG", optimize=True)
    print(f"OK {s}x{s} -> {name}")

square.resize((32, 32), Image.LANCZOS).save("public/favicon-32x32.png", "PNG", optimize=True)
print("OK 32x32 -> public/favicon-32x32.png")

for s in [192, 512]:
    canvas = Image.new("RGBA", (s, s), BRAND_BG)
    inner = int(s * 0.78)
    fg = square.resize((inner, inner), Image.LANCZOS)
    canvas.paste(fg, ((s - inner) // 2, (s - inner) // 2), fg)
    canvas.save(f"{OUT_DIR}/icon-{s}x{s}-maskable.png", "PNG", optimize=True)
    print(f"OK maskable {s}x{s}")

square.save("public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("OK favicon.ico")
print("\nAll icons generated from public/edullent-icon.png")
