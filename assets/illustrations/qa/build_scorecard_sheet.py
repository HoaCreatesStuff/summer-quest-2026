from pathlib import Path

from PIL import Image, ImageDraw


ICONS = Path(__file__).resolve().parents[1] / "icons"
OUTPUT = Path(__file__).resolve().parent / "final-scorecard-sheet.png"
ORDER = [1, 12, 2, 3, 4, 13, 19, 24, 8, 14, 11, 15, 7, 9, 10,
         16, 18, 23, 17, 22, 5, 20, 6, 21, 25]
FILES = {int(path.name[:2]): path for path in ICONS.glob("[0-9][0-9]-*.png")
         if not path.name.endswith("-48.png")}
COLORS = [(246, 185, 0), (243, 95, 89), (47, 143, 140)]

sheet = Image.new("RGB", (528, 528), (247, 242, 233))
draw = ImageDraw.Draw(sheet)
for index, icon_number in enumerate(ORDER):
    row, column = divmod(index, 5)
    x, y = 8 + column * 104, 8 + row * 104
    color = (232, 210, 162) if index == 24 else COLORS[index % 3]
    draw.rounded_rectangle((x, y, x + 97, y + 97), radius=16, fill=color)
    item = Image.open(FILES[icon_number]).convert("RGBA")
    item.thumbnail((72, 72), Image.Resampling.LANCZOS)
    sheet.paste(item, (x + (97 - item.width) // 2, y + (97 - item.height) // 2), item)
sheet.save(OUTPUT)

exact = Image.new("RGB", (528, 528), (247, 242, 233))
exact_draw = ImageDraw.Draw(exact)
for index, icon_number in enumerate(ORDER):
    row, column = divmod(index, 5)
    x, y = 8 + column * 104, 8 + row * 104
    color = (232, 210, 162) if index == 24 else COLORS[index % 3]
    exact_draw.rounded_rectangle((x, y, x + 97, y + 97), radius=16, fill=color)
    mobile_path = FILES[icon_number].with_name(FILES[icon_number].stem + "-48.png")
    item = Image.open(mobile_path).convert("RGBA")
    exact.paste(item, (x + 24, y + 24), item)
exact.save(OUTPUT.with_name("final-scorecard-48px-sheet.png"))
