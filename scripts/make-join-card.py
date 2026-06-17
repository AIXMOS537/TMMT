#!/usr/bin/env python3
"""GLOBAL MESH — JOIN card. One scannable sheet that gets ANY device on the mesh:
iPhone, Android, Mac/Linux, Windows. Pure Pillow + qrcode.
Run:  python3 scripts/make-join-card.py  ->  docs/cheatsheets/GLOBAL-MESH-JOIN.png (+pdf)
"""
import os, glob
from PIL import Image, ImageDraw, ImageFont
import qrcode

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cheatsheets")
os.makedirs(OUT, exist_ok=True)
W, H = 1240, 1754

def fp(*n):
    for x in n:
        for r in ["/usr/share/fonts","/Library/Fonts","/System/Library/Fonts"]:
            h=glob.glob(os.path.join(r,"**",x),recursive=True)
            if h: return h[0]
    return None
BOLD=fp("DejaVuSans-Bold.ttf"); REG=fp("DejaVuSans.ttf") or BOLD; MONO=fp("DejaVuSansMono-Bold.ttf","DejaVuSansMono.ttf") or BOLD
def F(s,b=True): return ImageFont.truetype(BOLD if b else REG, s)
def Mn(s): return ImageFont.truetype(MONO, s)

NAVY=(20,22,52); INK=(28,30,52); MUT=(120,126,160); WHITE=(255,255,255)
GREEN=(46,196,120); BLUE=(70,130,245); GOLD=(245,205,90); PURPLE=(150,110,240); CYAN=(70,200,215)

def qr(data, px):
    q=qrcode.QRCode(border=2, box_size=10); q.add_data(data); q.make(fit=True)
    return q.make_image(fill_color=(20,20,40), back_color="white").convert("RGB").resize((px,px))

im=Image.new("RGB",(W,H),(246,247,251)); d=ImageDraw.Draw(im)
def ctext(y,t,f,fill,cx=W//2):
    w=d.textbbox((0,0),t,font=f)[2]; d.text((cx-w//2,y),t,font=f,fill=fill)

# header
d.rectangle([0,0,W,180],fill=NAVY)
ctext(40,"GLOBAL MESH — JOIN",F(64),WHITE)
ctext(120,"any device · one private network · owner-approved",F(30,False),(180,186,220))

# step 0 — everyone installs Tailscale
d.rounded_rectangle([60,210,W-60,470],radius=24,fill=(232,238,255))
d.text((100,240),"STEP 1 — everyone installs Tailscale",font=F(38),fill=INK)
d.text((100,300),"the private mesh. install + sign in on every device.",font=F(28,False),fill=MUT)
d.text((100,344),"then the owner approves you (least-privilege).",font=F(28,False),fill=MUT)
im.paste(qr("https://tailscale.com/download",150),(W-230,250))
d.text((W-250,408),"scan to get it",font=F(22,False),fill=MUT)

# step 2 — per device cards (2x2)
ctext(500,"STEP 2 — set up your device",F(38),INK)
cards=[
 ("","iPhone / iPad",BLUE,["App Store: Tailscale + a-Shell","ssh into your node, type a word","one-tap buttons via Shortcuts"]),
 ("","Android",GREEN,["Play: Tailscale  ·  F-Droid: Termux","pkg install openssh; ssh in","Termux:Widget = home buttons"]),
 ("","Mac / Linux",PURPLE,["paste the one-liner (below)","pick owner or operator","then just type:  menu"]),
 ("","Windows",GOLD,["install Git + Tailscale","open Git Bash","paste the same one-liner"]),
]
gx=[60,640]; gy=[570,1010]; cw=540; ch=400
i=0
for cy in gy:
    for cx0 in gx:
        emoji,title,c,steps=cards[i]; i+=1
        d.rounded_rectangle([cx0,cy,cx0+cw,cy+ch],radius=22,fill=WHITE,outline=(225,228,240),width=2)
        d.rounded_rectangle([cx0,cy,cx0+cw,cy+70],radius=22,fill=c)
        d.rectangle([cx0,cy+40,cx0+cw,cy+70],fill=c)
        d.text((cx0+30,cy+14),title,font=F(34),fill=WHITE)
        yy=cy+100
        for s in steps:
            d.ellipse([cx0+30,yy+6,cx0+52,yy+28],fill=c)
            d.text((cx0+70,yy),s,font=F(25,False),fill=INK); yy+=64
        # device-specific QR
        if title.startswith("Mac") or title.startswith("Windows"):
            im.paste(qr("https://git-scm.com/downloads",120),(cx0+cw-150,cy+ch-150))
            d.text((cx0+cw-150,cy+ch-26),"git",font=F(20,False),fill=MUT)
i=0

# the one-liner (computers)
d.rounded_rectangle([60,1440,W-60,1560],radius=18,fill=NAVY)
d.text((90,1460),"Mac / Linux / Git-Bash — paste this one line:",font=F(24),fill=GOLD)
d.text((90,1500),"curl the repo → bash scripts/join   (see GO.md for the full line)",font=Mn(22),fill=(120,230,170))

# footer roster strip
d.rectangle([0,H-150,W,H],fill=NAVY)
ctext(H-130,"protected by AIXMOS Agents of Chaos · run by TMMT Operators",F(26),WHITE)
ctext(H-92,"watched by  Cyborg · Brainiac · Batman · Red Hood · Nightwing",F(24,False),(190,196,224))
ctext(H-52,"more operators pending down the pipeline",F(22,False),(150,156,200))

png=os.path.join(OUT,"GLOBAL-MESH-JOIN.png"); im.save(png)
try:
    import img2pdf
    with open(os.path.join(OUT,"GLOBAL-MESH-JOIN.pdf"),"wb") as f: f.write(img2pdf.convert([png]))
except Exception: pass
print("wrote",png)
