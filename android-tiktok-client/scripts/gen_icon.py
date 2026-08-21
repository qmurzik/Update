import os
from PIL import Image, ImageDraw, ImageFont

sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base_dir = os.path.join(project_root, "app", "src", "main", "res")

BG_TOP = (24, 21, 43)
BG_BOTTOM = (54, 26, 74)
ACCENT = (254, 44, 85)

for folder, size in sizes.items():
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for y in range(size):
        t = y / float(size - 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    margin = int(size * 0.08)
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=int(size * 0.22),
        outline=None,
    )

    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)

    play_size = size * 0.34
    cx, cy = size * 0.42, size * 0.5
    triangle = [
        (cx - play_size * 0.35, cy - play_size * 0.55),
        (cx - play_size * 0.35, cy + play_size * 0.55),
        (cx + play_size * 0.65, cy),
    ]
    draw.polygon(triangle, fill=(255, 255, 255, 255))

    bar_w = size * 0.09
    bar_h = size * 0.62
    bx = size * 0.72
    by = cy - bar_h / 2
    draw.rounded_rectangle(
        [bx, by, bx + bar_w, by + bar_h],
        radius=bar_w / 2,
        fill=ACCENT + (255,),
    )

    out_dir = os.path.join(base_dir, folder)
    os.makedirs(out_dir, exist_ok=True)
    img.save(os.path.join(out_dir, "ic_launcher.png"))
    img.save(os.path.join(out_dir, "ic_launcher_round.png"))

print("done")
