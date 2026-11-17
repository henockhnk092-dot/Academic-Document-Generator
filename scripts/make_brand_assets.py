"""Turn the Codex brand images into website assets.
  python scripts/make_brand_assets.py <brand_dir>
brand_dir holds app_icon.png (1024 square) and og_*.png (1536x1024).
Writes into client/public: favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png,
icons/icon-<size>.png (72..512), icons/maskable-512.png, og/<name>.jpg (1200x630, < 300 KB for WhatsApp)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

SRC = Path(sys.argv[1])
PUB = Path(__file__).resolve().parent.parent / "client" / "public"
(PUB / "icons").mkdir(exist_ok=True)
(PUB / "og").mkdir(exist_ok=True)
NAVY = (11, 18, 32)


def tile_only(im: Image.Image) -> Image.Image:
    """Crop to the icon tile (drop any empty margin Codex left) and make the corners outside it transparent."""
    im = im.convert("RGBA")
    bg = im.getpixel((2, 2))
    # bounding box of pixels that differ clearly from the corner colour
    diff = Image.new("L", im.size, 0)
    px, dp = im.load(), diff.load()
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            r, g, b, a = px[x, y]
            if a > 20 and abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 60:
                dp[x, y] = 255
    box = diff.getbbox() or (0, 0, im.width, im.height)
    side = max(box[2] - box[0], box[3] - box[1])
    cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
    sq = (max(0, cx - side // 2), max(0, cy - side // 2), min(im.width, cx + side // 2), min(im.height, cy + side // 2))
    out = im.crop(sq).resize((1024, 1024), Image.LANCZOS)
    mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1023, 1023], radius=220, fill=255)
    out.putalpha(mask)
    return out


icon = tile_only(Image.open(SRC / "app_icon.png"))
icon.save(SRC / "app_icon_tile.png")

def flat(size, bg=NAVY, pad=0.0):
    """Icon on a solid background (iOS and some launchers ignore transparency)."""
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    inner = int(size * (1 - 2 * pad))
    canvas.alpha_composite(icon.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    return canvas.convert("RGB")

for s in (16, 32):
    icon.resize((s, s), Image.LANCZOS).save(PUB / f"favicon-{s}x{s}.png")
icon.resize((256, 256), Image.LANCZOS).save(PUB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
flat(180).save(PUB / "apple-touch-icon.png")
for s in (72, 96, 128, 144, 152, 192, 384, 512):
    icon.resize((s, s), Image.LANCZOS).save(PUB / "icons" / f"icon-{s}x{s}.png")
flat(512, pad=0.1).save(PUB / "icons" / "maskable-512.png")   # 10% safe zone for Android masks
print("icons written")

for src in sorted(SRC.glob("og_*.png")):
    im = Image.open(src).convert("RGB")
    w = 1200
    h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    top = max(0, (h - 630) // 2)
    im = im.crop((0, top, w, top + 630))
    name = src.stem[3:]
    out = PUB / "og" / f"{name}.jpg"
    for q in (88, 82, 76, 70, 64):
        im.save(out, "JPEG", quality=q, optimize=True, progressive=True)
        if out.stat().st_size < 290_000:
            break
    print(f"og/{name}.jpg {out.stat().st_size // 1024} KB (q={q})")
