#!/usr/bin/env python3
"""Pocket card — a scannable setup card for new devices. QR codes for Tailscale
(public) + the Apple Shortcuts/Termux idea, plus the words. Pure Pillow+qrcode.
Run:  python3 scripts/make-pocket-card.py
Out:  docs/cheatsheets/POCKET-CARD.png
"""
import os, glob
from PIL import Image, ImageDraw, ImageFont
import qrcode

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cheatsheets")
os.makedirs(OUT, exist_ok=True)

def font_path(*names):
    for n in names:
        for r in ["/usr/share/fonts", "/Library/Fonts", "/System/Library/Fonts"]:
            h = glob.glob(os.path.join(r, "**", n), recursive=True)
            if h: return h[0]
    return None
BOLD = font_path("DejaVuSans-Bold.ttf"); REG = font_path("DejaVuSans.ttf") or BOLD
def F(s, b=True): return ImageFont.truetype(BOLD if b else REG, s)

def qr(data, box=10):
    q = qrcode.QRCode(border=2, box_size=box)
    q.add_data(data); q.make(fit=True)
    return q.make_image(fill_color=(20,20,40), back_color="white").convert("RGB")

W, H = 1400, 1000
img = Image.new("RGB", (W, H), (245, 246, 250))
d = ImageDraw.Draw(img)
d.rectangle([0,0,W,120], fill=(20,22,52))
d.text((50, 34), "TMMT · POCKET SETUP CARD", font=F(46), fill=(255,255,255))
d.text((50, 86), "owner-only · local · protect the user first", font=F(24, False), fill=(170,176,210))

# Three QR panels
panels = [
    ("1. Get Tailscale", "https://tailscale.com/download",
     "Install + sign in on every\nphone, Mac, and laptop.\nThis is the private mesh."),
    ("2. Get Git (Mac/Win)", "https://git-scm.com/downloads",
     "Mac usually has it.\nWindows: install, then use\n'Git Bash'."),
    ("3. Your words", "menu",
     "After setup, open a terminal\nand type:  menu\nThen tap a word."),
]
x = 60
for title, data, note in panels:
    d.text((x, 160), title, font=F(34), fill=(20,22,52))
    im = qr(data).resize((300, 300))
    img.paste(im, (x, 210))
    yy = 530
    for line in note.split("\n"):
        d.text((x, yy), line, font=F(24, False), fill=(60,64,90)); yy += 34
    x += 440

# words footer
d.rectangle([0, H-210, W, H], fill=(20,22,52))
d.text((50, H-196), "OWNER words:     unison · booyah · onboard · compass",
       font=F(26), fill=(245,224,138))
d.text((50, H-156), "OPERATOR words:  work · sync · who · sos · compass",
       font=F(26), fill=(245,224,138))
d.text((50, H-108), "Phone = a window into your local brain over Tailscale. Full guide: docs/MOBILE.md",
       font=F(23, False), fill=(180,186,215))
d.text((50, H-62), "Protect your peace.  Walk toward God — one step at a time.",
       font=F(26), fill=(255,255,255))

p = os.path.join(OUT, "POCKET-CARD.png")
img.save(p); print("wrote", p)
