#!/usr/bin/env python3
"""Founder Welcome Packet — colorful, hand-to-them onboarding PDF.
Builds docs/cheatsheets/FOUNDER-WELCOME.pdf (+ page PNGs). Pure Pillow, drawn icons.
Run:  python3 scripts/make-founder-packet.py
"""
import os, glob, math
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "cheatsheets")
os.makedirs(OUT, exist_ok=True)
W, H = 1240, 1754

def fp(*names):
    for n in names:
        for r in ["/usr/share/fonts","/Library/Fonts","/System/Library/Fonts"]:
            h = glob.glob(os.path.join(r,"**",n),recursive=True)
            if h: return h[0]
    return None
BOLD=fp("DejaVuSans-Bold.ttf"); REG=fp("DejaVuSans.ttf") or BOLD
MONO=fp("DejaVuSansMono-Bold.ttf","DejaVuSansMono.ttf") or BOLD
def F(s,b=True): return ImageFont.truetype(BOLD if b else REG, s)
def M(s): return ImageFont.truetype(MONO, s)

INK=(28,30,52); MUT=(110,116,150); WHITE=(255,255,255)
GREEN=(46,196,120); RED=(232,76,86); BLUE=(70,130,245); GOLD=(245,205,90)
PURPLE=(150,110,240); CYAN=(70,200,215); PINK=(235,120,160); NAVY=(20,22,52)

def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def page(bg=(247,248,252)):
    im=Image.new("RGB",(W,H),bg); return im, ImageDraw.Draw(im)
def ctext(d,y,t,f,fill,cx=W//2):
    w=d.textbbox((0,0),t,font=f)[2]; d.text((cx-w//2,y),t,font=f,fill=fill); return d.textbbox((0,0),t,font=f)[3]
def crescent(d,cx,cy,r,color=GOLD,bg=NAVY):
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=color); o=int(r*0.5); d.ellipse([cx-r+o,cy-r,cx+r+o,cy+r],fill=bg)
def pill(d,cx,y,w,h,color,label):
    x0=cx-w//2; d.rounded_rectangle([x0,y,x0+w,y+h],radius=h//2,fill=color)
    f=F(int(h*0.4)); tw=d.textbbox((0,0),label,font=f)[2]; d.text((cx-tw//2,y+int(h*0.27)),label,font=f,fill=WHITE)
def cmdbox(d,x,y,w,text):
    d.rounded_rectangle([x,y,x+w,y+70],radius=14,fill=(18,22,46))
    d.text((x+24,y+20),text,font=M(26),fill=(120,230,170))
def numdot(d,cx,cy,r,color,n):
    d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=color)
    f=F(int(r*1.1)); tw=d.textbbox((0,0),n,font=f)[2]; d.text((cx-tw//2,cy-int(r*0.62)),n,font=f,fill=WHITE)

pages=[]

# P1 cover
im,d=page(NAVY)
crescent(d,W//2,360,140)
ctext(d,560,"WELCOME",F(130),GOLD)
ctext(d,710,"to the network",F(52,False),(190,196,228))
d.rounded_rectangle([W//2-470,940,W//2+470,1180],radius=28,fill=(34,38,76))
ctext(d,985,"FOUNDING OPERATOR",F(48),WHITE)
ctext(d,1065,"Ayyan Khan  ·  MoeLegacy (Muhammad Umar)",F(34,False),(190,196,228))
ctext(d,1320,"powered by AIXMOS",F(36),CYAN)
ctext(d,1375,"backed by the Watchtower",F(32,False),MUT)
pages.append(im)

# P2 your founder deal
im,d=page()
ctext(d,100,"Your Founder Deal",F(78),INK)
ctext(d,210,"you were chosen first — for a reason",F(36,False),MUT)
d.rounded_rectangle([90,320,W-90,560],radius=30,fill=(232,248,238))
ctext(d,380,"Your brain is on us.",F(64),GREEN)
ctext(d,470,"$0 upfront. Full setup now.",F(40,False),INK)
items=[(GREEN,"Full stack + setup — covered today"),
       (BLUE,"Settle the $50K over time (hourly / salary / commission)"),
       (PURPLE,"The backend team runs the show — you grow"),
       (GOLD,"You're a founder: lowest cost, highest trust")]
y=650
for c,t in items:
    d.ellipse([120,y+8,160,y+48],fill=c); d.text((190,y),t,font=F(36,False),fill=INK); y+=110
d.rounded_rectangle([90,1140,W-90,1340],radius=28,fill=(245,240,255))
ctext(d,1185,"Your only job:",F(44),PURPLE)
ctext(d,1250,"keep your laptop on + online, learn, and earn.",F(34,False),INK)
pages.append(im)

# P3 three steps
im,d=page((240,250,244))
ctext(d,90,"3 Steps to Go Live",F(74),INK)
steps=[(GREEN,"1","Join the mesh","install Tailscale, sign in (owner approves you)"),
       (BLUE,"2","Flash deploy","one command sets up your whole node"),
       (PURPLE,"3","Wake your brain","your laptop becomes your private AI")]
cmds=["(install Tailscale app → sign in)",
      "bash scripts/motherbox operator",
      "bash scripts/setup-llm.sh"]
y=240
for (c,n,title,desc),cmd in zip(steps,cmds):
    numdot(d,180,y+60,60,c,n)
    d.text((280,y+10),title,font=F(50),fill=INK)
    d.text((280,y+78),desc,font=F(30,False),fill=MUT)
    cmdbox(d,280,y+125,860,cmd)
    y+=290
ctext(d,1140,"that's it. you're online.",F(40),GREEN)
ctext(d,1210,"then just type:  menu",F(34,False),MUT)
pages.append(im)

# P4 laptop = brain
im,d=page()
ctext(d,90,"Your Laptop = Your Brain",F(64),INK)
ctext(d,190,"private · local · yours. one command picks the right one.",F(30,False),MUT)
rows=[(GREEN,"8 GB","a real taste — drafting, Q&A, help"),
      (BLUE,"16–24 GB","a capable daily business helper"),
      (PURPLE,"32 GB","hosts everything + guides you"),
      (GOLD,"64 GB","full power, many tasks at once")]
y=320
for c,ram,desc in rows:
    d.rounded_rectangle([100,y,W-100,y+170],radius=24,fill=c)
    d.text((150,y+45),ram,font=F(60),fill=WHITE)
    d.text((480,y+62),desc,font=F(34,False),fill=WHITE)
    y+=205
ctext(d,1240,"upgrade anytime as you grow.",F(34,False),MUT)
cmdbox(d,170,1330,900,"bash scripts/setup-llm.sh   (or type:  brain )")
pages.append(im)

# P5 the ladder
im,d=page(NAVY)
ctext(d,90,"Where You Can Grow",F(70),WHITE)
ctext(d,185,"start small. climb. learn + earn.",F(34,False),(180,186,220))
ladder=[("$1,875","8GB — taste + leads/funnels/ads",GREEN),
        ("$3,750","16–24GB — helper + automations",CYAN),
        ("$7,500","32GB — hosts everything",BLUE),
        ("$15K","car rentals, ready to go",PURPLE),
        ("$25K","credit + funding + rentals",PINK),
        ("$35K","everything + a car (or no fee)",GOLD),
        ("$45–50K","full flash-deploy + managed store",(245,150,90)),
        ("$100K","everything — incl. Agent HAILMARY",RED)]
y=290; x=140
for price,desc,c in ladder:
    d.rounded_rectangle([x,y,W-100,y+118],radius=18,fill=(34,38,76))
    d.rounded_rectangle([x,y,x+30,y+118],radius=8,fill=c)
    d.text((x+60,y+18),price,font=F(40),fill=c)
    d.text((x+60,y+72),desc,font=F(26,False),fill=(205,210,235))
    y+=140; x+=18
pages.append(im)

# P6 your words
im,d=page()
ctext(d,110,"Your Words",F(78),INK)
ctext(d,220,"type one. it does the thing.",F(36,False),MUT)
words=[(GREEN,"menu","show the board"),(BLUE,"work","start your work"),
       (PURPLE,"sync","get the latest"),(CYAN,"compass","feel calm"),
       (GOLD,"who","who's online"),(RED,"sos","reach the team")]
y=340
for c,w_,desc in words:
    pill(d,360,y,470,118,c,w_); d.text((640,y+40),desc,font=F(34,False),fill=INK); y+=180
pages.append(im)

# P7 never alone
im,d=page(NAVY)
crescent(d,W//2,320,110)
ctext(d,500,"You're Never Alone",F(70),WHITE)
d.rounded_rectangle([110,680,W-110,940],radius=28,fill=(34,38,76))
ctext(d,720,"real business pros, on call",F(42),CYAN)
ctext(d,790,"when you need a hand — just ask (sos)",F(32,False),(200,206,235))
ctext(d,1020,'say  "compass"  anytime',F(44),GOLD)
ctext(d,1090,"one calm step, whenever it's heavy",F(32,False),(200,206,235))
d.rounded_rectangle([110,1230,W-110,1500],radius=28,fill=(34,38,76))
ctext(d,1280,"Protect your peace.",F(50),GOLD)
ctext(d,1360,"Walk toward God — one step at a time.",F(36,False),WHITE)
ctext(d,1420,"with Islamic + financial guidance",F(30,False),(180,186,220))
pages.append(im)

# save
pp=[]
for i,im in enumerate(pages,1):
    p=os.path.join(OUT,f"founder-p{i}.png"); im.save(p); pp.append(p)
pdf=os.path.join(OUT,"FOUNDER-WELCOME.pdf")
try:
    import img2pdf
    with open(pdf,"wb") as f: f.write(img2pdf.convert(pp))
except Exception:
    pages[0].save(pdf,save_all=True,append_images=pages[1:],resolution=150.0)
print("wrote",pdf,"and",len(pages),"pages")
