#!/usr/bin/env python3
"""Generate the caveman-simple TMMT cheat sheet: a picture PDF + phone PNGs.
Run:  python3 scripts/make-cheatsheet.py
Out:  docs/cheatsheets/TMMT-CHEAT-SHEET.pdf  + page PNGs + TMMT-PHONE.png
Pure Pillow; real color emoji via Noto Color Emoji. No network needed.
"""
import os, glob
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cheatsheets")
os.makedirs(OUT, exist_ok=True)

# ---- fonts -------------------------------------------------------------------
def find_font(*names):
    roots = ["/usr/share/fonts", "/usr/local/share/fonts", "/Library/Fonts", "/System/Library/Fonts"]
    for n in names:
        for r in roots:
            hits = glob.glob(os.path.join(r, "**", n), recursive=True)
            if hits:
                return hits[0]
    return None

BOLD = find_font("DejaVuSans-Bold.ttf", "Arial Bold.ttf", "Helvetica.ttc") or ""
REG  = find_font("DejaVuSans.ttf", "Arial.ttf", "Helvetica.ttc") or BOLD
EMOJI = find_font("NotoColorEmoji.ttf")

def font(path, size):
    return ImageFont.truetype(path, size) if path else ImageFont.load_default()

_emoji_cache = {}
def emoji_img(ch, px):
    """Render one emoji at a target pixel size (Noto bitmap only supports 109)."""
    key = (ch, px)
    if key in _emoji_cache: return _emoji_cache[key]
    if not EMOJI:
        return None
    base = Image.new("RGBA", (140, 140), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    try:
        ef = ImageFont.truetype(EMOJI, 109)
        d.text((10, 10), ch, font=ef, embedded_color=True)
    except Exception:
        return None
    bbox = base.getbbox()
    if bbox: base = base.crop(bbox)
    img = base.resize((px, px), Image.LANCZOS)
    _emoji_cache[key] = img
    return img

# ---- palette -----------------------------------------------------------------
INK   = (17, 24, 39)
MUTED = (107, 114, 128)
W     = (255, 255, 255)
BLUE  = (37, 99, 235)
GREEN = (22, 163, 74)
RED   = (220, 38, 38)
AMBER = (217, 119, 6)
SLATE = (30, 41, 59)
CARD_BORDER = (226, 232, 240)

PW, PH = 1240, 1754  # A4 @ ~150 dpi
MX = 80

def new_page(bg=W):
    return Image.new("RGB", (PW, PH), bg)

def text(d, xy, s, f, fill=INK, anchor="la"):
    d.text(xy, s, font=f, fill=fill, anchor=anchor)

def paste_emoji(img, ch, x, y, px, fallback_color=BLUE, fallback_letter=""):
    e = emoji_img(ch, px)
    if e is not None:
        img.paste(e, (int(x), int(y)), e)
    else:
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([x, y, x+px, y+px], radius=px//6, fill=fallback_color)
        if fallback_letter:
            text(d, (x+px/2, y+px/2), fallback_letter, font(BOLD, px//2), W, "mm")

def rounded(d, box, radius, fill=None, outline=None, width=3):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def header_bar(img, title, sub, color=SLATE):
    d = ImageDraw.Draw(img)
    rounded(d, [MX, 70, PW-MX, 70+150], 28, fill=color)
    text(d, (MX+50, 110), title, font(BOLD, 64), W)
    if sub: text(d, (MX+52, 190), sub, font(REG, 30), (203,213,225))

def step_card(img, y, num, emoji, title, lines, accent=BLUE, h=210):
    d = ImageDraw.Draw(img)
    rounded(d, [MX, y, PW-MX, y+h], 26, fill=W, outline=CARD_BORDER, width=3)
    # number badge
    bx, by, bs = MX+40, y+h/2-45, 90
    d.ellipse([bx, by, bx+bs, by+bs], fill=accent)
    text(d, (bx+bs/2, by+bs/2), str(num), font(BOLD, 56), W, "mm")
    # emoji
    paste_emoji(img, emoji, MX+170, y+h/2-55, 110, accent)
    # text
    tx = MX+320
    text(d, (tx, y+40), title, font(BOLD, 46), INK)
    ly = y+105
    for ln in lines:
        text(d, (tx, ly), ln, font(REG, 34), MUTED)
        ly += 46

def footer(img, n, total):
    d = ImageDraw.Draw(img)
    text(d, (PW/2, PH-70), f"TMMT × AIXMOS  —  for the people, by the people   ·   {n}/{total}",
         font(REG, 26), MUTED, "mm")

pages = []

# ---- Page 1: COVER -----------------------------------------------------------
p = new_page(SLATE); d = ImageDraw.Draw(p)
rounded(d, [MX, 120, PW-MX, PH-120], 40, fill=W)
text(d, (PW/2, 300), "TMMT", font(BOLD, 150), INK, "mm")
text(d, (PW/2, 410), "RUN THE WHOLE BUSINESS", font(BOLD, 52), BLUE, "mm")
text(d, (PW/2, 470), "from your laptop + your phone", font(REG, 36), MUTED, "mm")
# three big icons
icons = [("\U0001F4BB","LAPTOP","the engine"),("\U0001F9E0","BRAIN","does the work"),("\U0001F4F1","PHONE","your remote")]
ix = PW/2 - 360
for ch,t1,t2 in icons:
    paste_emoji(p, ch, ix, 600, 170, BLUE)
    text(d, (ix+85, 800), t1, font(BOLD, 40), INK, "ma")
    text(d, (ix+85, 850), t2, font(REG, 30), MUTED, "ma")
    ix += 360
rounded(d, [MX+120, 1000, PW-MX-120, 1180], 26, fill=(239,246,255))
text(d, (PW/2, 1060), "2 STEPS TO GO LIVE", font(BOLD, 44), BLUE, "mm")
text(d, (PW/2, 1120), "1. Plug in the laptop     2. Run  tmmt up", font(REG, 36), INK, "mm")
text(d, (PW/2, 1320), "For Muhammad + Moe", font(BOLD, 40), INK, "mm")
text(d, (PW/2, 1380), "Simple as pressing a button.", font(REG, 32), MUTED, "mm")
footer(p, 1, 6); pages.append(p)

# ---- Page 2: TURN IT ON ------------------------------------------------------
p = new_page(); header_bar(p, "TURN IT ON", "Do this every morning. Takes 1 minute.", GREEN)
y = 280
step_card(p, y, 1, "\U0001F50C", "Plug in the laptop", ["Power + internet. Leave it plugged in.","It carries the load. Don't close the lid."], GREEN); y+=240
step_card(p, y, 2, "⌨️", "Open the black window", ["It's called Terminal.","Spotlight (cmd+space) → type Terminal → Enter."], GREEN); y+=240
step_card(p, y, 3, "\U0001F4AC", "Type one thing", ["bash scripts/tmmt up","then press Enter."], GREEN); y+=240
step_card(p, y, 4, "✅", "Wait for GREEN", ["Green check = you are LIVE on the mesh.","Now leave it running. You're done."], GREEN); y+=240
footer(p, 2, 6); pages.append(p)

# ---- Page 3: EVEN EASIER (menu) ---------------------------------------------
p = new_page(); header_bar(p, "EVEN EASIER", "Don't like typing? Use the button menu.", BLUE)
d = ImageDraw.Draw(p); y=300
step_card(p, y, 1, "\U0001F5B1️", "Double-click TMMT-MENU", ["It's in your TMMT folder.","A menu opens in the black window."], BLUE, h=200); y+=230
# menu mock
rounded(d, [MX, y, PW-MX, y+560], 26, fill=SLATE);
mt = font("/" ,0) if False else font(BOLD, 40)
text(d, (MX+60, y+40), "TMMT  CONTROL", font(BOLD, 44), W)
opts = ["1)  Turn it ON","2)  Who's online","3)  I NEED HELP","4)  Do work (agents)","5)  Health check","6)  Sync now","0)  Quit"]
oy=y+120
for o in opts:
    text(d, (MX+70, oy), o, font(REG, 38), (226,232,240)); oy+=58
y+=600
step_card(p, y, 2, "\U0001F446", "Press a number", ["Press 1 to go live. Press 3 if you need help.","That's the whole system. Promise."], BLUE, h=200)
footer(p, 3, 6); pages.append(p)

# ---- Page 4: FROM YOUR PHONE ------------------------------------------------
p = new_page(); header_bar(p, "FROM YOUR PHONE", "Be mobile. The laptop does the heavy lifting.", BLUE)
y=280
step_card(p, y, 1, "\U0001F4AC", "Talk in Slack", ["Open Slack → #ops. Type what you need.","The team AND the brain see it."], BLUE); y+=240
step_card(p, y, 2, "\U0001F198", "Buzz for help", ["In Slack type:  help","Or on the laptop:  tmmt help \"what's wrong\""], RED); y+=240
step_card(p, y, 3, "\U0001F6F0️", "Power move: control the laptop", ["Install the Termius app on your phone.","Tap your laptop → you're typing on it from anywhere."], BLUE); y+=240
step_card(p, y, 4, "\U0001F501", "It stays in sync", ["Every laptop + phone shares one brain.","Pick up on any device, right where you left off."], BLUE); y+=240
footer(p, 4, 6); pages.append(p)

# ---- Page 5: WHEN IT BREAKS -------------------------------------------------
p = new_page(); header_bar(p, "WHEN IT BREAKS", "Nobody panics. Help is one word away.", RED)
y=300
step_card(p, y, 1, "\U0001F628", "Something's wrong?", ["Don't guess. Don't poke around.","Just ask for help ↓"], AMBER, h=200); y+=230
step_card(p, y, 2, "\U0001F198", "Send the SOS", ["tmmt help \"engine won't start, customer waiting\"","(or press 3 in the menu)"], RED, h=200); y+=230
step_card(p, y, 3, "\U0001F4F2", "The owner gets buzzed", ["Muhammad gets it on his phone instantly.","He sees who, where, and what."], BLUE, h=200); y+=230
step_card(p, y, 4, "\U0001F91D", "Help arrives", ["He jumps in — by your side, or remotely","over the secure mesh. Fixed. Back to work."], GREEN, h=200)
footer(p, 5, 6); pages.append(p)

# ---- Page 6: THE ONLY WORDS -------------------------------------------------
p = new_page(); header_bar(p, "THE ONLY WORDS YOU NEED", "Type  bash scripts/tmmt  then one word.", SLATE)
d = ImageDraw.Draw(p)
rows = [("▶️","up","turn on + go live",GREEN),
        ("\U0001F465","who","who's online",BLUE),
        ("\U0001F198","help \"...\"","buzz the owner",RED),
        ("⚡","go","start the agents working",AMBER),
        ("\U0001F501","sync","get the latest",BLUE),
        ("\U0001F6E1️","fix","health + safety check",SLATE)]
y=300
for emoji,word,desc,acc in rows:
    rounded(d, [MX, y, PW-MX, y+170], 24, fill=W, outline=CARD_BORDER, width=3)
    paste_emoji(p, emoji, MX+40, y+35, 100, acc)
    text(d, (MX+190, y+45), word, font(BOLD, 54), acc)
    text(d, (MX+190, y+115), desc, font(REG, 34), MUTED)
    y+=195
footer(p, 6, 6); pages.append(p)

# ---- Save page PNGs, then assemble a lossless PDF (Flate, no JPEG dep) -------
png_paths = []
for i, pg in enumerate(pages, 1):
    pp = os.path.join(OUT, f"page{i}.png")
    pg.save(pp); png_paths.append(pp)

pdf_path = os.path.join(OUT, "TMMT-CHEAT-SHEET.pdf")
try:
    import img2pdf
    with open(pdf_path, "wb") as fh:
        fh.write(img2pdf.convert(png_paths))
except Exception as e:
    # Fallback: palette-mode PDF via Pillow (no JPEG needed).
    pal = [p.convert("P", palette=Image.ADAPTIVE, colors=256) for p in pages]
    pal[0].save(pdf_path, save_all=True, append_images=pal[1:], resolution=150.0)

# ---- Phone wallpaper (the essentials, tall) ---------------------------------
PWp, PHp = 1170, 2532
ph = Image.new("RGB", (PWp, PHp), SLATE); d = ImageDraw.Draw(ph)
text(d, (PWp/2, 240), "TMMT", font(BOLD, 150), W, "mm")
text(d, (PWp/2, 360), "quick commands", font(REG, 44), (148,163,184), "mm")
rows = [("▶️","tmmt up","go live",GREEN),
        ("\U0001F198","tmmt help \"...\"","SOS to owner",RED),
        ("\U0001F465","tmmt who","who's online",BLUE),
        ("⚡","tmmt go","agents work",AMBER),
        ("\U0001F501","tmmt sync","get latest",BLUE)]
y=560
for emoji,word,desc,acc in rows:
    rounded(d, [70, y, PWp-70, y+300], 36, fill=W)
    paste_emoji(ph, emoji, 110, y+85, 130, acc)
    text(d, (300, y+90), word, font(BOLD, 66), acc)
    text(d, (300, y+185), desc, font(REG, 48), MUTED)
    y+=360
text(d, (PWp/2, PHp-120), "Need help? Just type  tmmt help", font(REG, 40), (148,163,184), "mm")
ph.save(os.path.join(OUT, "TMMT-PHONE.png"))

print("Wrote:", pdf_path)
print("Pages:", ", ".join(f"page{i}.png" for i in range(1, len(pages)+1)))
print("Phone:", os.path.join(OUT, "TMMT-PHONE.png"))
