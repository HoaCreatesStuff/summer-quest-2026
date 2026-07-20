from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1] / "icons"
QA = ROOT.parent / "qa"
CANVAS = 1254


def alpha_bounds(image: Image.Image):
    return image.getchannel("A").getbbox()


def reframe(image: Image.Image, target_fraction: float, y_offset: int = 0):
    box = alpha_bounds(image)
    subject = image.crop(box)
    scale = target_fraction * CANVAS / max(subject.size)
    size = tuple(max(1, round(v * scale)) for v in subject.size)
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (CANVAS, CANVAS))
    position = ((CANVAS - size[0]) // 2, (CANVAS - size[1]) // 2 + y_offset)
    output.alpha_composite(subject, position)
    return output


def save_icon(image: Image.Image, filename: str):
    image.save(ROOT / filename)
    image.resize((48, 48), Image.Resampling.LANCZOS).save(
        ROOT / filename.replace(".png", "-48.png")
    )


def recolor(image: Image.Image, region, predicate, target, reference_luma):
    pixels = image.load()
    x0, y0, x1, y1 = region
    for y in range(y0, min(y1, image.height)):
        for x in range(x0, min(x1, image.width)):
            r, g, b, a = pixels[x, y]
            if not a or not predicate(r, g, b):
                continue
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            ratio = max(0.68, min(1.32, luma / reference_luma))
            pixels[x, y] = tuple(min(255, round(c * ratio)) for c in target) + (a,)
    return image


def remove_magenta(image: Image.Image):
    image = image.convert("RGBA")
    corners = [image.getpixel((0, 0)), image.getpixel((image.width - 1, 0)),
               image.getpixel((0, image.height - 1)),
               image.getpixel((image.width - 1, image.height - 1))]
    key = tuple(sum(pixel[channel] for pixel in corners) / 4 for channel in range(3))
    output = Image.new("RGBA", image.size)
    source = image.load()
    destination = output.load()
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


# #3: teal underside only -> palette navy.
hat = Image.open(ROOT / "02-street-fashion.png").convert("RGBA")
hat = recolor(hat, (0, 560, 520, 1000),
              lambda r, g, b: g > r * 1.08 and g > b * 1.08,
              (25, 57, 78), 112)
save_icon(hat, "02-street-fashion.png")

# #8 and #15: increase optical size again.
for filename, target, y_offset in [
    ("24-random-kindness.png", 0.99, 5),
    ("10-farmers-market.png", 0.985, 6),
]:
    save_icon(reframe(Image.open(ROOT / filename).convert("RGBA"), target, y_offset), filename)

# #18: door only -> project gold, retaining its panel construction.
stoop = Image.open(ROOT / "23-group-stoop.png").convert("RGBA")
stoop = recolor(stoop, (410, 120, 810, 700),
                 lambda r, g, b: r < 75 and g < 75 and b < 75,
                 (246, 185, 0), 37)
save_icon(stoop, "23-group-stoop.png")

# #17: regenerated lower, horizontal spray-paint composition.
spray_source = Image.open(ROOT / "sources/18-street-mural-chroma.png")
spray = reframe(remove_magenta(spray_source), 0.92)
save_icon(spray, "18-street-mural.png")


ORDER = [1, 12, 2, 3, 4, 13, 19, 24, 8, 14, 11, 15, 7, 9, 10,
         16, 18, 23, 17, 22, 5, 20, 6, 21, 25]
FILES = {int(path.name[:2]): path for path in ROOT.glob("[0-9][0-9]-*.png")
         if not path.name.endswith("-48.png")}
COLORS = [(246, 185, 0), (243, 95, 89), (47, 143, 140)]


def make_scorecard_sheet():
    sheet = Image.new("RGB", (528, 528), (247, 242, 233))
    draw = ImageDraw.Draw(sheet)
    margin, gap, cell = 8, 7, 97
    for index, icon_number in enumerate(ORDER):
        row, column = divmod(index, 5)
        x = margin + column * (cell + gap)
        y = margin + row * (cell + gap)
        color = (232, 210, 162) if index == 24 else COLORS[index % 3]
        draw.rounded_rectangle((x, y, x + cell, y + cell), radius=16, fill=color)
        icon = Image.open(FILES[icon_number]).convert("RGBA")
        icon.thumbnail((72, 72), Image.Resampling.LANCZOS)
        sheet.paste(icon, (x + (cell - icon.width) // 2, y + (cell - icon.height) // 2), icon)
    sheet.save(QA / "final-scorecard-sheet.png")


make_scorecard_sheet()

for filename in ["02-street-fashion.png", "24-random-kindness.png",
                 "10-farmers-market.png", "23-group-stoop.png", "18-street-mural.png"]:
    image = Image.open(ROOT / filename)
    print(filename, image.size, alpha_bounds(image))
