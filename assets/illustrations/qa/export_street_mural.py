from pathlib import Path

from PIL import Image, ImageDraw


ICONS = Path(__file__).resolve().parents[1] / "icons"
QA = ICONS.parent / "qa"
CANVAS = 1254


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


def reframe(image, target_fraction=0.92):
    subject = image.crop(image.getchannel("A").getbbox())
    scale = target_fraction * CANVAS / max(subject.size)
    size = tuple(round(value * scale) for value in subject.size)
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (CANVAS, CANVAS))
    output.alpha_composite(subject, ((CANVAS - size[0]) // 2, (CANVAS - size[1]) // 2))
    return output


source = Image.open(ICONS / "sources/18-street-mural-chroma.png")
icon = reframe(remove_magenta(source))
icon.save(ICONS / "18-street-mural.png")
icon.resize((48, 48), Image.Resampling.LANCZOS).save(ICONS / "18-street-mural-48.png")

# Refresh the scorecard-size comparison using all current production icons.
order = [1, 12, 2, 3, 4, 13, 19, 24, 8, 14, 11, 15, 7, 9, 10,
         16, 18, 23, 17, 22, 5, 20, 6, 21, 25]
files = {int(path.name[:2]): path for path in ICONS.glob("[0-9][0-9]-*.png")
         if not path.name.endswith("-48.png")}
colors = [(246, 185, 0), (243, 95, 89), (47, 143, 140)]
sheet = Image.new("RGB", (528, 528), (247, 242, 233))
draw = ImageDraw.Draw(sheet)
for index, icon_number in enumerate(order):
    row, column = divmod(index, 5)
    x, y = 8 + column * 104, 8 + row * 104
    color = (232, 210, 162) if index == 24 else colors[index % 3]
    draw.rounded_rectangle((x, y, x + 97, y + 97), radius=16, fill=color)
    item = Image.open(files[icon_number]).convert("RGBA")
    item.thumbnail((72, 72), Image.Resampling.LANCZOS)
    sheet.paste(item, (x + (97 - item.width) // 2, y + (97 - item.height) // 2), item)
sheet.save(QA / "final-scorecard-sheet.png")

print("Exported 18-street-mural.png and 18-street-mural-48.png")
