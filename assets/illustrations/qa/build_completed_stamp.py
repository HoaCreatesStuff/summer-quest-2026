from pathlib import Path

from PIL import Image


ILLUSTRATIONS = Path(__file__).resolve().parents[1]
SOURCE = ILLUSTRATIONS / "overlays/sources/completed-stamp-reference.png"
OUTPUT = ILLUSTRATIONS / "overlays/completed-stamp.png"
MOBILE_OUTPUT = ILLUSTRATIONS / "overlays/completed-stamp-256.png"


def remove_white(image):
    image = image.convert("RGBA")
    output = Image.new("RGBA", image.size)
    source, destination = image.load(), output.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = source[x, y]
            distance = max(255 - r, 255 - g, 255 - b)
            t = max(0.0, min(1.0, (distance - 10.0) / 52.0))
            alpha = t * t * (3.0 - 2.0 * t)
            if alpha <= 0.002:
                continue
            rgb = tuple(max(0, min(255, round((value - (1 - alpha) * 255) / alpha)))
                        for value in (r, g, b))
            destination[x, y] = rgb + (round(255 * alpha),)
    return output


stamp = remove_white(Image.open(SOURCE))
stamp = stamp.crop(stamp.getchannel("A").getbbox())
stamp = stamp.rotate(45, resample=Image.Resampling.BICUBIC, expand=True)
stamp = stamp.crop(stamp.getchannel("A").getbbox())

canvas_size = 1024
target = round(canvas_size * 0.88)
scale = target / max(stamp.size)
size = tuple(round(value * scale) for value in stamp.size)
stamp = stamp.resize(size, Image.Resampling.LANCZOS)
canvas = Image.new("RGBA", (canvas_size, canvas_size))
canvas.alpha_composite(stamp, ((canvas_size - size[0]) // 2, (canvas_size - size[1]) // 2))
canvas.save(OUTPUT, optimize=True)
canvas.resize((256, 256), Image.Resampling.LANCZOS).save(MOBILE_OUTPUT, optimize=True)

print(OUTPUT)
print(MOBILE_OUTPUT)
