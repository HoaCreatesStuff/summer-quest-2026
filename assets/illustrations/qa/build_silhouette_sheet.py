from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ICONS = Path(__file__).resolve().parents[1] / "icons"
OUTPUT = Path(__file__).resolve().parent / "final-silhouette-sheet.png"
ORDER = [1, 12, 2, 3, 4, 13, 19, 24, 8, 14, 11, 15, 7, 9, 10,
         16, 18, 23, 17, 22, 5, 20, 6, 21, 25]
NAMES = ["Golden Hour", "Judgmental Pigeon", "Street Fashion", "Free Event",
         "Waterfront Wonders", "Dance Party", "SHOWTIME!", "Random Kindness",
         "Favorite Art", "DIY Craft", "Hidden Bookstore", "Pup-arazzi",
         "Iconic Skyline", "Kindness Notes", "Farmers Market", "Get Sweaty",
         "Street Mural", "Group Stoop", "Favorite Hideaway", "Cinema Moment",
         "Park Picnic", "Birthday Selfie", "Animal Statue", "Human Pyramid",
         "Celebrate Together"]
FILES = {int(path.name[:2]): path for path in ICONS.glob("[0-9][0-9]-*.png")
         if not path.name.endswith("-48.png")}

sheet = Image.new("RGB", (600, 608), (247, 242, 233))
draw = ImageDraw.Draw(sheet)
font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
font = ImageFont.truetype(font_path, 11)

for index, icon_number in enumerate(ORDER):
    row, column = divmod(index, 5)
    x, y = 8 + column * 120, 8 + row * 120
    draw.rounded_rectangle((x, y, x + 112, y + 112), radius=16, fill=(255, 252, 247))
    alpha = Image.open(FILES[icon_number]).convert("RGBA").getchannel("A")
    subject = Image.new("RGBA", alpha.size, (39, 37, 34, 0))
    subject.putalpha(alpha)
    subject.thumbnail((78, 70), Image.Resampling.LANCZOS)
    sheet.paste(subject, (x + (112 - subject.width) // 2, y + 10), subject)
    label = f"{index + 1:02d} {NAMES[index]}"
    width = draw.textbbox((0, 0), label, font=font)[2]
    draw.text((x + max(4, (112 - width) // 2), y + 90), label, fill=(111, 106, 99), font=font)

sheet.save(OUTPUT)
