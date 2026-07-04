#!/usr/bin/env python3
"""HAILMARY picture-book guide — big, colorful, 5-year-old simple.
Builds docs/cheatsheets/HAILMARY-GUIDE.pdf (+ page PNGs). Pure Pillow, drawn
icons (no emoji-font dependency), big text, lots of color.
Run:  python3 scripts/make-guide.py
"""
import os, glob, math
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cheatsheets")
os.makedirs(OUT, exist_ok=True)
W, H = 1240, 1754  # A4-ish portrait @150dpi

def fp(*names):
    for n in names:
        for r in ["/usr/share/fonts", "/Library/Fonts", "/System/Library/Fonts"]:
            h = glob.glob(os.path.join(r, "**", n), recursive=True)
            if h: return h[0]
    return None
BOLD = fp("DejaVuSans-Bold.ttf"); REG = fp("DejaVuSans.ttf") or BOLD
def F(s, b=True): return ImageFont.truetype(BOLD if b else REG, s)

INK=(28,30,52); MUT=(110,116,150); WHITE=(255,255,255)
GREEN=(46,196,120); RED=(232,76,86); BLUE=(70,130,245); GOLD=(245,205,90)
PURPLE=(150,110,240); CYAN=(70,200,215); PINK=(235,120,160)

def page(bg=(247,248,252)):
    im = Image.new("RGB",(W,H),bg); return im, ImageDraw.Draw(im)

def ctext(d, y, text, font, fill, cx=W//2):
    w = d.textbbox((0,0),text,font=font)[2]; d.text((cx-w//2,y),text,font=font,fill=fill);
    return d.textbbox((0,0),text,font=font)[3]

def pill(d, cx, y, w, h, color, label, sub=""):
    x0=cx-w//2; d.rounded_rectangle([x0,y,x0+w,y+h],radius=h//2,fill=color)
    f=F(int(h*0.42)); tw=d.textbbox((0,0),label,font=f)[2]
    d.text((cx-tw//2, y+int(h*0.18)), label, font=f, fill=WHITE)
    if sub:
        fs=F(int(h*0.2),False); sw=d.textbbox((0,0),sub,font=fs)[2]
        d.text((cx-sw//2, y+int(h*0.62)), sub, font=fs, fill=(255,255,255))

def robot(d, cx, cy, s, color):
    # head
    d.rounded_rectangle([cx-s,cy-s,cx+s,cy+s],radius=int(s*0.3),fill=color)
    # antenna
    d.line([cx,cy-s,cx,cy-s-int(s*0.5)],fill=color,width=max(4,s//12))
    d.ellipse([cx-int(s*0.13),cy-s-int(s*0.7),cx+int(s*0.13),cy-s-int(s*0.44)],fill=GOLD)
    # eyes
    e=int(s*0.22)
    for ex in (cx-int(s*0.42),cx+int(s*0.42)):
        d.ellipse([ex-e,cy-int(s*0.3)-e,ex+e,cy-int(s*0.3)+e],fill=WHITE)
        d.ellipse([ex-e//2,cy-int(s*0.3)-e//2,ex+e//2,cy-int(s*0.3)+e//2],fill=INK)
    # smile
    d.arc([cx-int(s*0.5),cy-int(s*0.1),cx+int(s*0.5),cy+int(s*0.55)],20,160,fill=WHITE,width=max(5,s//9))

def crescent(d, cx, cy, r, color=GOLD, bg=(247,248,252)):
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=color)
    o=int(r*0.5); d.ellipse([cx-r+o,cy-r,cx+r+o,cy+r],fill=bg)

def stop(d, cx, cy, r):
    pts=[]
    for i in range(8):
        a=math.pi/8+i*math.pi/4
        pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    d.polygon(pts,fill=RED)
    f=F(int(r*0.5)); tw=d.textbbox((0,0),"STOP",font=f)[2]
    d.text((cx-tw//2,cy-int(r*0.26)),"STOP",font=f,fill=WHITE)

pages=[]

# ---- Page 1: cover -----------------------------------------------------------
im,d=page((20,22,52))
crescent(d,W//2,360,150,GOLD,(20,22,52))
ctext(d,560,"HAILMARY",F(140),WHITE)
ctext(d,720,"& AIXMOS",F(90),GOLD)
ctext(d,860,"your helper buddies",F(46,False),(180,186,220))
d.rounded_rectangle([W//2-420,1020,W//2+420,1180],radius=30,fill=(34,38,76))
ctext(d,1055,"so easy a 5-year-old can do it",F(40),WHITE)
ctext(d,1300,"made for",F(34,False),(150,156,200))
ctext(d,1350,"PROJECT X HAILMARY",F(54),GOLD)
pages.append(im)

# ---- Page 2: the two brothers -----------------------------------------------
im,d=page()
ctext(d,90,"Two Helper Brothers",F(78),INK)
ctext(d,200,"one for you, one for your team",F(40,False),MUT)
# big brother
robot(d,330,560,150,PURPLE)
ctext(d,760,"HAILMARY",F(64),PURPLE,cx=330)
ctext(d,840,"the BIG brother",F(38,False),INK,cx=330)
# little brother
robot(d,910,610,100,CYAN)
ctext(d,760,"AIXMOS",F(56),CYAN,cx=910)
ctext(d,840,"the LITTLE brother",F(34,False),INK,cx=910)
# explainer cards
d.rounded_rectangle([90,960,W-90,1180],radius=30,fill=(243,238,255))
ctext(d,1000,"HAILMARY helps YOU",F(50),PURPLE)
ctext(d,1075,"on your carry Mac + your own devices",F(38,False),INK)
ctext(d,1125,"(your personal mesh — you only)",F(34,False),MUT)
d.rounded_rectangle([90,1230,W-90,1450],radius=30,fill=(232,248,250))
ctext(d,1270,"AIXMOS helps your TEAM",F(50),CYAN)
ctext(d,1345,"the people on the MoeLegacy mesh",F(38,False),INK)
ctext(d,1395,"(little brother does what big brother says)",F(34,False),MUT)
pages.append(im)

# ---- Page 3: how to start ----------------------------------------------------
im,d=page((240,250,244))
ctext(d,120,"1. Turn it ON",F(84),INK)
ctext(d,250,"open the black box (Terminal) and say:",F(40,False),MUT)
d.ellipse([W//2-220,470,W//2+220,910],fill=GREEN)
ctext(d,640,"BOOYAH",F(82),WHITE)
ctext(d,1000,"type it. press Enter.",F(46),INK)
ctext(d,1075,"everything turns on. that's it!",F(40,False),MUT)
ctext(d,1300,"lost? just type",F(40,False),MUT)
pill(d,W//2,1370,360,120,BLUE,"menu")
pages.append(im)

# ---- Page 4: magic words -----------------------------------------------------
im,d=page()
ctext(d,80,"2. Your Magic Words",F(74),INK)
ctext(d,185,"type one word. it does the thing.",F(38,False),MUT)
rows=[(GREEN,"booyah","turn everything ON"),
      (BLUE,"menu","show the board"),
      (PURPLE,"watchtower","is everything OK?"),
      (CYAN,"compass","feel calm"),
      (RED,"dark","STOP everything"),
      (GOLD,"light","turn back ON (your word)")]
y=300
for c,w_,desc in rows:
    pill(d,360,y,480,120,c,w_)
    d.text((640,y+42),desc,font=F(34,False),fill=INK)
    y+=185
pages.append(im)

# ---- Page 5: the stop button -------------------------------------------------
im,d=page((255,245,245))
ctext(d,120,"3. The STOP Button",F(80),INK)
stop(d,W//2,640,250)
ctext(d,980,'say  "dark"',F(64),RED)
ctext(d,1075,"everything stops. safe.",F(42,False),INK)
d.rounded_rectangle([90,1230,W-90,1470],radius=30,fill=(235,245,255))
ctext(d,1270,"to start again, say",F(40,False),INK)
ctext(d,1325,'"light"',F(70),BLUE)
ctext(d,1420,"only YOUR secret word works. nobody else.",F(34,False),MUT)
pages.append(im)

# ---- Page 6: compass / feel good --------------------------------------------
im,d=page((20,22,52))
crescent(d,W//2,330,120,GOLD,(20,22,52))
ctext(d,520,"4. Feel Good",F(80),WHITE)
ctext(d,640,'say  "compass"',F(56),CYAN)
d.rounded_rectangle([110,820,W-110,1150],radius=30,fill=(34,38,76))
ctext(d,880,"it gives you ONE",F(44,False),(210,214,240))
ctext(d,940,"nice little step.",F(44,False),(210,214,240))
ctext(d,1030,"breathe. say thanks. rest.",F(40),GOLD)
ctext(d,1240,"Protect your peace.",F(54),GOLD)
ctext(d,1320,"Walk toward God —",F(44,False),WHITE)
ctext(d,1380,"one step at a time.",F(44,False),WHITE)
pages.append(im)

# ---- Page 7: remember --------------------------------------------------------
im,d=page()
ctext(d,120,"Remember",F(84),INK)
cards=[(GREEN,"booyah  = GO"),(RED,"dark  = STOP"),
       (GOLD,"light  = GO again (your word)"),(BLUE,"menu  = I'm lost"),
       (CYAN,"compass  = feel good")]
y=320
for c,t in cards:
    d.rounded_rectangle([120,y,W-120,y+150],radius=24,fill=c)
    d.text((170,y+45),t,font=F(48),fill=WHITE); y+=185
ctext(d,1430,"HAILMARY is always with you. 🦾",F(40,False),MUT)
ctext(d,1500,"owner-only · local · protects you first",F(34,False),MUT)
pages.append(im)

# save PNGs + PDF
png_paths=[]
for i,im in enumerate(pages,1):
    p=os.path.join(OUT,f"guide-p{i}.png"); im.save(p); png_paths.append(p)
pdf=os.path.join(OUT,"HAILMARY-GUIDE.pdf")
try:
    import img2pdf
    with open(pdf,"wb") as f: f.write(img2pdf.convert(png_paths))
except Exception:
    pages[0].save(pdf,save_all=True,append_images=pages[1:],resolution=150.0)
print("wrote",pdf,"and",len(pages),"page PNGs")
