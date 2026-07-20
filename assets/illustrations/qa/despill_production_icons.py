from pathlib import Path

from PIL import Image


ICONS = Path(__file__).resolve().parents[1] / "icons"
PALETTE = [(243, 95, 89), (246, 185, 0), (47, 143, 140),
           (255, 244, 210), (25, 57, 78), (39, 37, 34)]


def is_key_fringe(pixel):
    r, g, b, a = pixel
    return (a > 24 and r > 180 and b > 120 and g < 90
            and r > g * 1.8 and b > g * 1.6)


def nearest_palette(rgb):
    return min(PALETTE, key=lambda color: sum((rgb[i] - color[i]) ** 2 for i in range(3)))


total = 0
for path in sorted(ICONS.glob("[0-9][0-9]-*.png")):
    if path.name.endswith("-48.png"):
        continue
    image = Image.open(path).convert("RGBA")
    source = image.copy()
    source_pixels, pixels = source.load(), image.load()
    flagged = [(x, y) for y in range(image.height) for x in range(image.width)
               if is_key_fringe(source_pixels[x, y])]
    for x, y in flagged:
        samples = []
        for yy in range(max(0, y - 3), min(image.height, y + 4)):
            for xx in range(max(0, x - 3), min(image.width, x + 4)):
                candidate = source_pixels[xx, yy]
                if candidate[3] > 48 and not is_key_fringe(candidate):
                    distance = max(1, abs(xx - x) + abs(yy - y))
                    samples.append((candidate, candidate[3] / distance))
        r, g, b, a = source_pixels[x, y]
        if samples:
            weight = sum(item[1] for item in samples)
            replacement = tuple(round(sum(item[0][channel] * item[1] for item in samples) / weight)
                                for channel in range(3))
        else:
            replacement = nearest_palette((r, g, b))
        pixels[x, y] = replacement + (a,)
    if flagged:
        image.save(path)
        image.resize((48, 48), Image.Resampling.LANCZOS).save(
            path.with_name(path.stem + "-48.png"))
        print(path.name, len(flagged))
        total += len(flagged)

print("despilled pixels", total)
