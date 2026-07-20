from pathlib import Path
from statistics import mean

from PIL import Image, ImageDraw


ICONS = Path(__file__).resolve().parents[1] / "icons"
QA = ICONS.parent / "qa"
CANVAS = 1254
ORDER = [1, 12, 2, 3, 4, 13, 19, 24, 8, 14, 11, 15, 7, 9, 10,
         16, 18, 23, 17, 22, 5, 20, 6, 21, 25]
COLORS = [(246, 185, 0), (243, 95, 89), (47, 143, 140)]


def remove_magenta(image):
    image = image.convert("RGBA")
    corners = [image.getpixel((0, 0)), image.getpixel((image.width - 1, 0)),
               image.getpixel((0, image.height - 1)),
               image.getpixel((image.width - 1, image.height - 1))]
    key = tuple(sum(pixel[channel] for pixel in corners) / 4 for channel in range(3))
    output = Image.new("RGBA", image.size)
    source, destination = image.load(), output.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = source[x, y]
            distance = max(abs(r - key[0]), abs(g - key[1]), abs(b - key[2]))
            t = max(0.0, min(1.0, (distance - 24.0) / 68.0))
            alpha = t * t * (3.0 - 2.0 * t)
            if alpha <= 0.002:
                continue
            rgb = tuple(max(0, min(255, round((value - (1 - alpha) * key[i]) / alpha)))
                        for i, value in enumerate((r, g, b)))
            destination[x, y] = rgb + (round(255 * alpha),)
    return output


def reframe(image, target_fraction=0.755, y_offset=-21):
    subject = image.crop(image.getchannel("A").getbbox())
    scale = target_fraction * CANVAS / max(subject.size)
    size = tuple(round(value * scale) for value in subject.size)
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (CANVAS, CANVAS))
    x = (CANVAS - size[0]) // 2
    y = (CANVAS - size[1]) // 2 + y_offset
    output.alpha_composite(subject, (x, y))
    return output


cranes = reframe(remove_magenta(Image.open(ICONS / "sources/24-random-kindness-chroma.png")))
cranes.save(ICONS / "24-random-kindness.png")
cranes.resize((48, 48), Image.Resampling.LANCZOS).save(ICONS / "24-random-kindness-48.png")


files = {int(path.name[:2]): path for path in ICONS.glob("[0-9][0-9]-*.png")
         if not path.name.endswith("-48.png")}

# Exact 48 px scorecard sheet: mobile assets are pasted 1:1, never enlarged.
sheet = Image.new("RGB", (528, 528), (247, 242, 233))
draw = ImageDraw.Draw(sheet)
for index, icon_number in enumerate(ORDER):
    row, column = divmod(index, 5)
    x, y = 8 + column * 104, 8 + row * 104
    color = (232, 210, 162) if index == 24 else COLORS[index % 3]
    draw.rounded_rectangle((x, y, x + 97, y + 97), radius=16, fill=color)
    item = Image.open(ICONS / files[icon_number].name.replace(".png", "-48.png")).convert("RGBA")
    sheet.paste(item, (x + 24, y + 24), item)
sheet.save(QA / "final-scorecard-48px-sheet.png")


report = []
for position, icon_number in enumerate(ORDER, start=1):
    full_path = files[icon_number]
    mobile_path = ICONS / full_path.name.replace(".png", "-48.png")
    full = Image.open(full_path).convert("RGBA")
    mobile = Image.open(mobile_path).convert("RGBA")
    assert full.size == (1254, 1254) and mobile.size == (48, 48)
    assert full.getpixel((0, 0))[3] == 0 and mobile.getpixel((0, 0))[3] == 0
    bounds = full.getchannel("A").getbbox()
    left, top, right, bottom = bounds
    margins = (left, top, CANVAS - right, CANVAS - bottom)
    alpha = full.getchannel("A")
    weighted_x = weighted_y = weight = 0
    for y in range(full.height):
        row_weight = 0
        for x in range(full.width):
            value = alpha.getpixel((x, y))
            row_weight += value
            weighted_x += x * value
        weighted_y += y * row_weight
        weight += row_weight
    cx, cy = weighted_x / weight, weighted_y / weight
    bg = (232, 210, 162) if position == 25 else COLORS[(position - 1) % 3]
    distances = []
    mobile_pixels = mobile.load()
    for y in range(48):
        for x in range(48):
            r, g, b, a = mobile_pixels[x, y]
            if a >= 128:
                distances.append(((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5)
    contrast_mean = mean(distances) if distances else 0
    report.append(
        f"{position:02d} {full_path.stem}: bounds={right-left}x{bottom-top}; "
        f"margins={margins}; alpha-centroid-offset=({cx-626.5:+.1f},{cy-626.5:+.1f}); "
        f"mean-card-color-distance={contrast_mean:.1f}"
    )

(QA / "production-audit.txt").write_text("\n".join(report) + "\n")
print("Exported paper cranes and audited 25 full-size + 25 mobile PNGs")
