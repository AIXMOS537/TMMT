# AIXMOS — MASTER BUILD DOCUMENT
# Paste this into Codex, Claude Code, or Cursor as your project context.
# Everything an AI coding tool needs to understand, extend, and build AIXMOS.

---

## WHAT THIS IS

AIXMOS is a workforce infrastructure platform built for everyday entrepreneurs.
It combines dispatching, AI agents, operator networks, vendor routing, and
business-in-a-box deployment into one ecosystem.

**Founder:** Muhammad Taha
**Mission:** Help everyday people access the American Dream through systems,
automation, virtual assistance, and operational infrastructure.
**Tagline:** For the people. By the people.
**Target:** $10,000/month for every client.
**Standard:** 5-star restaurant — every interaction is premium.

---

## TECH STACK

- **Frontend:** Vanilla HTML + CSS + JS (no framework required for portal/landing)
- **React:** Used for the CHUMMO messaging agent artifact
- **Backend:** GoHighLevel (GHL) for CRM, payments, automations, pipeline
- **Payments:** Stripe (via GHL)
- **Hosting:** UGREEN NAS (60TB) running Docker + nginx for the portal
- **AI Agents:** Anthropic API (claude-sonnet-4-20250514) for CHUMMO messaging
- **Fonts:** Bebas Neue (display) + DM Sans (body) — Google Fonts
- **Domain 1:** Main AIXMOS website (landing + intake form)
- **Domain 2:** Private portal (portal.yourdomain.com → UGREEN NAS)

---

## BRAND / DESIGN SYSTEM

```css
:root {
  --blue:      #1440C4;   /* Primary — buttons, accents, headings */
  --blue-2:    #2563EB;   /* Hover state */
  --blue-dim:  rgba(20,64,196,0.07); /* Tinted backgrounds */
  --navy:      #0A1628;   /* Dark text, dark backgrounds */
  --white:     #FFFFFF;   /* Page background */
  --surface:   #F4F7FF;   /* Section backgrounds */
  --border:    rgba(10,37,102,0.10); /* Default borders */
  --muted:     rgba(10,22,40,0.50);  /* Secondary text */
  --green:     #1D9E75;   /* Success */
  --red:       #C0392B;   /* Error / exit */
  --amber:     #D97706;   /* Warning / warm */
  --font-d:    'Bebas Neue', sans-serif;  /* Display / headings */
  --font-b:    'DM Sans', sans-serif;     /* Body text */
}
```

**Rules:**
- Blue and white is the color system. No dark backgrounds on main pages.
- Bebas Neue for all large headings and numbers.
- DM Sans for all body text, labels, descriptions.
- Buttons: blue background, white text. Hover: --blue-2.
- Borders: 0.5px or 1px solid var(--border).
- Border radius: 8px (small), 12px (cards), 16px (sections).
- No gradients. No shadows (except subtle card lift).

---

## FILES ALREADY BUILT

All files are production-ready HTML. Paths reference the UGREEN NAS structure.

```
project-root/
├── public/
│   ├── index.html              ← Main AIXMOS landing page (blue/white)
│   ├── apply.html              ← Standalone intake form page
│   └── thankyou.html           ← Post-submission confirmation (TO BUILD)
├── portal/
│   └── index.html              ← Private 4-role portal (login + dashboards)
├── files/                      ← Served as static assets from NAS
│   ├── operator-training.html  ← Full operator training manual (14 sections)
│   ├── intake-form.html        ← CHUMMO 5-step intake form
│   └── pipeline.html           ← GHL pipeline guide (12 stages)
├── agent/
│   └── ChummoAgent.jsx         ← React messaging agent (Anthropic API)
├── docker/
│   ├── docker-compose.yml      ← UGREEN NAS deployment
│   └── nginx.conf              ← Web server config
└── docs/
    └── CLAUDE.md               ← This file (Claude Code reads automatically)
```

---

## GHL INTEGRATION POINTS

Search for these placeholders and replace with real GHL links:

| Placeholder | Replace With |
|---|---|
| `YOUR_GHL_97_CHECKOUT_LINK` | $97/month Stripe subscription checkout URL |
| `YOUR_GHL_LLC_CHECKOUT_LINK` | $397 one-time checkout URL |
| `YOUR_GHL_3750_CHECKOUT_LINK` | $3,750 down payment checkout URL |
| `YOUR_GHL_OPERATOR_APPLICATION_LINK` | Operator application form URL |
| `YOUR_GHL_WEBHOOK_URL` | GHL webhook for form submissions |
| `YOUR_GHL_FORM_ID` | GHL native form ID for embed |

**GHL Pipeline Stages (12):**
1. New lead
2. Contacted
3. Intake submitted
4. Call booked
5. Call completed
6. Proposal sent
7. Payment received
8. Active client
9. Upgrade ready
10. Paused
11. Completed
12. Exited

**GHL Tags:**
- Urgency: hot | warm | cold | stalled
- Tier: tier-membership | tier-llc | tier-credit | tier-base-3750 | tier-enterprise-7500 | tier-rental-15k | tier-ecom-25k | tier-full-50k
- Service: needs-credit-first | needs-llc-first | needs-funding | needs-ghl-setup
- Status: paid | unpaid | operator-assigned | upgrade-ready | escorted-out

---

## THE SERVICE MENU (PRICING)

| Tier | Price | Model | Notes |
|---|---|---|---|
| Membership | $97/month | Recurring subscription | Entry point for everyone |
| LLC Formation | $397 | One-time | Formation + filing guidance |
| Credit Guidance | $500–$1,000 | One-time | GUIDE only — delegate to vendors |
| Base Infrastructure | $3,750 | Down payment | GHL + website + automations |
| Enterprise Systems | $7,500 | Project | Full build + automation |
| Car Rental in a Box | $15,000 | 50% down | Vehicle ops + staffing + systems |
| E-Commerce Ecosystem | $25,000 | 50% down | Full setup + $10K inventory float |
| Full Ecosystem | $50,000 | Structured | All verticals + revenue share |

**Operator commissions (referral track):** 10% of everything they close.
**Partnership track:** 50/50 split — AIXMOS manages, operator executes.

---

## THE THREE AI AGENTS

### CHUMMO
- Personality: Caring, listening, empathetic
- Function: Intake, translation, triage, relationship building
- Lives on: Flash drive + Anthropic API
- Voice: Friend first. Warm. Direct. Never corporate.

### MOOSE
- Personality: Relentless, proactive, executing
- Function: Fulfillment, automation, follow-ups, backend ops
- Lives on: Flash drive + automation platform
- Voice: Gets things done without being told. Sees what needs to happen.

### VISION
- Personality: Precise, watchful, uncompromising
- Function: Quality control, review, standards enforcement
- Lives on: GHL + monitoring layer
- Voice: Nothing leaves the AIXMOS system below standard.

---

## THE 4-ROLE PORTAL

### Role: admin (Muhammad only)
- Full dashboard: revenue, pipeline, all operators, all clients
- Access: ALL files, ALL panels, settings
- Sees: Daily summary reports, escalations, NAS storage overview

### Role: executive (3 overseas executives)
- Dashboard: their department operators, escalations, client pipeline
- Access: Training vault, SOPs, operator management
- Cannot see: Admin financials, settings, other executives' data

### Role: operator (field coordinators)
- Dashboard: my clients, my earnings, my calls this week
- Access: Training vault (their tier), call scripts, CHUMMO tools
- Cannot see: Other operators' clients, executive layer

### Role: member (paying clients)
- Dashboard: my pathway progress, 90-day roadmap, $10K target
- Access: Their tier's resources, contact operator, upgrade path
- Cannot see: Anything outside their own journey

**Auth system:** Session-based (sessionStorage). For production, upgrade to:
- Node.js + Express + JWT tokens
- Or Supabase Auth (free tier works)
- Or Cloudflare Access (zero-trust, connects to UGREEN)

---

## UGREEN NAS DEPLOYMENT

### Docker Compose (save as docker-compose.yml on NAS):
```yaml
version: '3.8'
services:
  portal:
    image: nginx:alpine
    container_name: aixmos-portal
    ports:
      - "8080:80"
    volumes:
      - /share/AIXMOS/portal:/usr/share/nginx/html:ro
      - /share/AIXMOS/files:/usr/share/nginx/html/files:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped

  landing:
    image: nginx:alpine
    container_name: aixmos-landing
    ports:
      - "8081:80"
    volumes:
      - /share/AIXMOS/public:/usr/share/nginx/html:ro
      - /share/AIXMOS/files:/usr/share/nginx/html/files:ro
    restart: unless-stopped
```

### Nginx Config:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /files/ {
        alias /usr/share/nginx/html/files/;
        add_header Content-Disposition "inline";
    }

    gzip on;
    gzip_types text/html text/css application/javascript;
}
```

### NAS Folder Structure:
```
/share/AIXMOS/
├── portal/
│   └── index.html          ← Private portal (4-role)
├── public/
│   ├── index.html          ← Landing page
│   ├── apply.html          ← Intake form
│   └── thankyou.html       ← Confirmation page
├── files/
│   ├── operator-training.html
│   ├── intake-form.html
│   └── pipeline.html
├── training-videos/        ← Upload MP4s here (60TB)
├── operator-sops/          ← PDF SOPs
├── member-resources/       ← Client-facing content
└── admin-only/             ← Muhammad's private files
```

### Remote Access:
1. UGOS → Network → DDNS → Enable (gives you a remote URL)
2. Or: Set up UGREEN's built-in reverse proxy
3. Point your second domain's DNS A record → your public IP
4. Enable port forwarding: router port 8080/8081 → NAS IP

---

## WHAT STILL NEEDS TO BE BUILT

Priority order (build in this sequence):

### IMMEDIATE (generates revenue this week)
1. **Thank you page** (`/public/thankyou.html`)
   - Post-payment / post-form confirmation
   - Shows: "Application received. Operator in 24 hours."
   - Timeline: 24hrs → 48hrs → Day 7 → Day 90
   - Blue and white, AIXMOS branded

2. **Operator application page** (`/public/operator.html`)
   - For people who want to JOIN as operators
   - Explains 50/50 model, independent track, referral track
   - Has a short application form (name, phone, email, why, which track)
   - Routes to GHL webhook on submit

3. **Replace all GHL placeholder links** in index.html
   - See GHL Integration Points section above

### SHORT TERM (week 1–2)
4. **GHL post-payment automations**
   - One workflow per tier
   - Trigger: payment confirmed
   - Actions: welcome email → intake form link → operator assignment → calendar

5. **Server-side auth for portal**
   - Replace sessionStorage with JWT or Supabase
   - Add password reset flow
   - Add invite-only registration for operators/members

6. **File browser component** for Training Vault
   - List files from /files/ directory dynamically
   - Support: PDF preview, video player, doc download
   - Role-based: show only files their role can access

7. **Mobile responsive improvements**
   - Portal sidebar collapses to hamburger on mobile
   - Landing page grid stacks properly
   - Touch-friendly tap targets

### MEDIUM TERM (next 30 days)
8. **Truck dispatching vertical page**
   - New section on landing page + separate /truck.html
   - Owner-operator dispatch model
   - Same AIXMOS pricing/operator structure

9. **GHL API integration in portal**
   - Pull live pipeline data from GHL API
   - Show real contact counts, payment totals
   - Operator can update client stage from portal

10. **Video training vault**
    - Video player component (HTML5 video pointing to NAS)
    - Categories: Credit guidance, Business fundamentals, Operations, Automotive
    - Progress tracking (mark as watched)

11. **CHUMMO messaging agent integration in portal**
    - Embed the React agent inside the portal's Tools panel
    - Operators access it without leaving the portal

12. **Investor one-pager** (`/public/investor.html`)
    - Muhammad's story, receipts, model, ask
    - Clean, printable, shareable

---

## PROMPTS FOR EACH TOOL

### FOR CODEX (paste this + the codebase):
```
I'm building AIXMOS — a workforce infrastructure platform.
Read the CLAUDE.md file for full project context.
The codebase is pure HTML/CSS/JS + one React component.
Start by: (1) replacing all GHL placeholder links with real ones once I provide them,
(2) building the thank you page and operator application page,
(3) making the portal sidebar responsive on mobile.
Ask me before making any structural changes to the existing files.
```

### FOR CLAUDE CODE (run in project root):
```
Read CLAUDE.md first. Then:
1. Audit all existing HTML files for broken links and placeholder text
2. Build /public/thankyou.html and /public/operator.html
3. Set up the docker-compose.yml and nginx.conf for UGREEN NAS
4. Add server-side auth to the portal using Supabase Auth (free tier)
Do not change the design system or color tokens without asking.
```

### FOR CURSOR (open project folder, then paste):
```
This is the AIXMOS project. Read CLAUDE.md for full context.
Design system: blue #1440C4, white background, Bebas Neue + DM Sans fonts.
I need you to:
1. Build a mobile hamburger drawer for the landing page nav
2. Add scroll animations (fade-up, 0.5s, IntersectionObserver)
3. Build the thank you page matching the landing page design
4. Build the operator application page
5. Make the portal sidebar collapse to a drawer on mobile
After each task, show me what changed before moving to the next.
```

---

## CHUMMO VOICE — NON-NEGOTIABLE

Every message, email, and interaction follows these rules:

- Friend first. Always. Before any pitch.
- Warm, direct, human — never corporate or scripted.
- Short sentences. White space. Easy to read on a phone.
- Never say: "I'm following up" / "As per my last" / "Circle back" / "Hope this finds you well"
- Never open with the company name or a price.
- Always open with the person's name.
- One call to action per message — never two.
- SMS: under 160 characters when possible.
- Email: short paragraphs, no jargon, feels like a real person who cares.

---

## THE FOUNDER STORY (for About pages, pitches, investor decks)

Muhammad Taha came to America at 6 years old and immediately started navigating
systems for his family — housing, documents, taxes. He's been solving operational
problems for people he loves his entire life.

At 22, he built a car rental operation to $90,000–$100,000/month for someone else.
He was told to screw off and walked away with nothing.

He rebuilt. With his parents' backing, he generated $250,000 in a year.
He has since touched over $1,000,000 in operations.
He closed a $50,000 investor on the spot by offering his entire pipeline for a 50/50 split.

He lost two brothers. AIXMOS is for them.
One of their mothers is getting her house paid for. This has to print.

The mission: give every overlooked, bottlenecked, first-generation entrepreneur
the same infrastructure that large corporations already have.

**For the people. By the people.**

---

## IMPORTANT RULES FOR AI TOOLS

1. Never change the color system without asking (blue: #1440C4, white bg)
2. Never change the font system (Bebas Neue + DM Sans)
3. Never remove GHL integration points — just update placeholders
4. Never add external dependencies without asking (keep it lean)
5. Never add dark mode (blue/white is the brand)
6. Always test on mobile before marking a task complete
7. Keep all HTML files self-contained (no build step required for deployment)
8. The portal auth is client-side for now — flag before upgrading to server-side
9. All copy must match the CHUMMO voice — no corporate language
10. The $10K/month target appears on every client-facing page

---

## CONTACT / OWNER

Project: AIXMOS
Founder: Muhammad Taha
Built with: Claude (Anthropic)
Stack: HTML + CSS + JS + GHL + UGREEN NAS + Anthropic API
Version: 1.0 — Pre-launch
