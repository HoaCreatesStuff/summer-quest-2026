from PIL import Image, ImageDraw, ImageFont


SOURCE = (
    "/Users/hoanguyen/Documents/Summer Quest 2026/tmp/imagegen/"
    "home-screen-help-triptych-preview.png"
)
OUTPUT = (
    "/Users/hoanguyen/Documents/Summer Quest 2026/tmp/imagegen/"
    "home-screen-help-triptych-labeled-preview.png"
)
FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"

image = Image.open(SOURCE).convert("RGBA")
draw = ImageDraw.Draw(image)

small = ImageFont.truetype(FONT_PATH, 20, index=0)
ios_row = ImageFont.truetype(FONT_PATH, 17, index=0)
android_row = ImageFont.truetype(FONT_PATH, 21, index=0)
label_color = (32, 94, 104, 255)


def centered_label(text: str, center: tuple[int, int], font: ImageFont.FreeTypeFont) -> None:
    draw.text(center, text, font=font, fill=label_color, anchor="mm")


# Safari: label the emphasized toolbar control without adding competing UI copy.
centered_label("Share", (314, 642), small)

# iOS Share Sheet: place the exact action label inside the highlighted row.
draw.text(
    (786, 611),
    "Add to Home Screen",
    font=ios_row,
    fill=label_color,
    anchor="lm",
)

# Android overflow menu: place the exact action label inside the highlighted option.
draw.text(
    (1370, 550),
    "Install app",
    font=android_row,
    fill=label_color,
    anchor="lm",
)

image.save(OUTPUT, "PNG")
