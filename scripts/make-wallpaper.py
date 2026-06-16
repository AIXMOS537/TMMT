#!/usr/bin/env python3
"""HAILMARY phone wallpaper — the one-word commands + the Compass line, as a
clean lock-screen picture. Pure Pillow, no network.
Run:  python3 scripts/make-wallpaper.py
Out:  docs/cheatsheets/HAILMARY-PHONE.png  (1170x2532, iPhone) + -ANDROID.png
"""
import os, glob, math
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cheatsheets")
os.makedirs(OUT, exist_ok=True)

def font_path(*names):
    roots = ["/usr/share/fonts", "/usr/local/share/fonts", "/Library/Fonts", "/System/Library/Fonts"]
    for n in names:
        for r in roots:
            hits = glob.glob(os.path.join(r, "**", n), recursive=True)
            if hits: return hits[0]
    return None

BOLD = font_path("DejaVuSans-Bold.ttf") or ""
REG  = font_path("DejaVuSans.ttf") or BOLD
def F(sz, bold=True): return ImageFont.truetype(BOLD if bold else REG, sz)

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def render(W, H, fname):
    img = Image.new("RGB", (W, H), (8, 10, 24))
    d = ImageDraw.Draw(img)
    # vertical gradient: deep indigo -> near black
    top, bot = (24, 20, 64), (6, 8, 20)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(top, bot, y / H))

    cx = W // 2
    # crescent + star (the "picture")
    R = int(W * 0.11); ox, oy = cx, int(H * 0.13)
    d.ellipse([ox-R, oy-R, ox+R, oy+R], fill=(245, 224, 138))
    off = int(R*0.55)
    d.ellipse([ox-R+off, oy-R, ox+R+off, oy+R], fill=lerp(top, bot, oy/H))
    # little star
    sx, sy, sr = ox+int(R*1.25), oy-int(R*0.2), int(R*0.28)
    star = []
    for i in range(10):
        ang = -math.pi/2 + i*math.pi/5
        rr = sr if i % 2 == 0 else sr*0.45
        star.append((sx+rr*math.cos(ang), sy+rr*math.sin(ang)))
    d.polygon(star, fill=(245, 224, 138))

    def center(text, y, font, fill):
        w = d.textbbox((0,0), text, font=font)[2]
        d.text((cx - w//2, y), text, font=font, fill=fill)

    center("HAILMARY", int(H*0.235), F(int(W*0.105)), (255,255,255))
    center("in your pocket · owner-only · local", int(H*0.285), F(int(W*0.032), False), (170,176,210))

    # the words
    rows = [
        ((120,230,170), "unison",  "boot everything"),
        ((150,200,255), "menu",    "the picture board"),
        ((180,160,255), "booyah",  "wake HAILMARY"),
        ((255,200,120), "onboard", "decode a client"),
        ((120,225,235), "compass", "one step toward God"),
        ((230,150,170), "hailmary","what he knows"),
    ]
    y = int(H*0.36); step = int(H*0.072)
    for dot, word, desc in rows:
        d.ellipse([int(W*0.13)-14, y+int(W*0.04)-14, int(W*0.13)+14, y+int(W*0.04)+14], fill=dot)
        d.text((int(W*0.20), y), word, font=F(int(W*0.062)), fill=(255,255,255))
        d.text((int(W*0.20), y+int(W*0.066)), desc, font=F(int(W*0.030), False), fill=(165,172,205))
        y += step

    # compass line at the bottom
    by = int(H*0.86)
    d.rounded_rectangle([int(W*0.08), by, int(W*0.92), by+int(H*0.075)], radius=28,
                        fill=(18, 22, 46), outline=(70,76,120), width=2)
    center("Protect your peace.", by+int(H*0.012), F(int(W*0.040)), (245,224,138))
    center("Walk toward God — one step at a time.", by+int(H*0.042), F(int(W*0.030), False), (200,206,235))

    img.save(os.path.join(OUT, fname))
    print("wrote", os.path.join(OUT, fname))

render(1170, 2532, "HAILMARY-PHONE.png")      # iPhone
render(1080, 2340, "HAILMARY-ANDROID.png")    # common Android
