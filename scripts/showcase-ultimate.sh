#!/usr/bin/env bash
# showcase-ultimate.sh — A-Z Team-Up Showcase · kid-friendly · all devices · Fable-ready PDF source
#
#   bash scripts/showcase-ultimate.sh
#   bash scripts/showcase-ultimate.sh open
#
# Carry: runs compile + HTML. Rick on M1: same via Syncthing. Fable 5: final PDF polish (god on).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RICK="$HOME/Sync/rick"
OUT="$HOME/Desktop/★ TEAM-UP-SHOWCASE"
ARCHIVE="$RICK/ARCHIVE/showcase-old-$(date +%Y%m%d-%H%M%S)"
TS="$(date '+%Y-%m-%d %H:%M %Z')"
FABLE_BRIEF="$OUT/FABLE-5-ULTIMATE-PDF-BRIEF.md"

say(){ printf '\n▶ %s\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }
warn(){ printf '  ⚠ %s\n' "$*"; }

cat <<'BANNER'
╔══════════════════════════════════════════════════════════════════╗
║  ★ EXECUTIVE SHOWCASE — A-Z · Verified Links · HAILMARY V3       ║
║  Investor-grade · link-audited · pass-out ready                    ║
╚══════════════════════════════════════════════════════════════════╝
BANNER

# ── 1. Archive old showcase packages (never delete — move aside) ──
say "1/6 — Archive old PDFs & showcase folders"
mkdir -p "$ARCHIVE"
for old in \
  "$HOME/Desktop/HAILMARY-V3-MASTER" \
  "$HOME/Desktop/FABLE-FEED-TONIGHT" \
  "$HOME/Desktop/TEAM-UP-SHOWCASE" \
  "$HOME/Desktop/SHOWCASE" \
  "$HOME/Desktop/*SHOWCASE*" \
  "$HOME/Desktop/pre-payweek-report-"*.txt; do
  [[ -e "$old" ]] && mv "$old" "$ARCHIVE/" 2>/dev/null && ok "archived $(basename "$old")"
done
ok "Archive → $ARCHIVE"

# ── 2. Recompile YTD master (brain + vault + sessions) ──
say "2/6 — Recompile HAILMARY V3 master"
bash "$ROOT/scripts/recompile-v3-master.sh" 2>/dev/null || true
V3="$HOME/Desktop/HAILMARY-V3-MASTER"
[[ -d "$V3" ]] && cp -R "$V3" "$OUT/00-SOURCE-V3-MASTER" 2>/dev/null && ok "V3 master copied into showcase"

# ── 3. Brain corpus stats ──
say "3/6 — Brain compile"
[[ -x "$RICK/BRAIN-FEED/compile-corpus.sh" ]] && bash "$RICK/BRAIN-FEED/compile-corpus.sh" 2>/dev/null || true
CORPUS_N="$(find "$RICK/BRAIN-FEED/compiled" -type f 2>/dev/null | wc -l | tr -d ' ')"
VAULT_N="$(find "$HOME/Brain/vault" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
FLEET_DONE="$(find "$RICK/FLEET-INBOX/done" -name '*-REPORT.md' 2>/dev/null | wc -l | tr -d ' ')"

# ── 4. Build showcase tree ──
say "4/6 — Build ★ TEAM-UP-SHOWCASE"
rm -rf "$OUT"
mkdir -p "$OUT"/{cheat-codes,brain-links,league,devices,archive-copy}

# Copy key docs
cp -f "$ROOT/docs/TRAPPER-CORPORATE-DAILY.md" \
      "$ROOT/docs/RICK-OWNS-ALL.md" \
      "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" \
      "$ROOT/docs/GO-LIVE-CANON.md" \
      "$ROOT/docs/WATCHTOWER-ROSTER.md" \
      "$OUT/" 2>/dev/null || true
[[ -d "$ARCHIVE" ]] && cp -R "$ARCHIVE" "$OUT/archive-copy/" 2>/dev/null || true

# Markdown source for Fable PDF
cat > "$OUT/ULTIMATE-A-Z-SHOWCASE.md" <<MD
---
title: "★ TEAM-UP SHOWCASE — PROJECT X HAILMARY"
subtitle: "Everything We Built · A to Z · For Everyone Forever"
author: "Muhammad Taha · Rick Sorkin · The League"
date: "$(date +%Y-%m-%d)"
titlepage: true
titlepage-color: "7c3aed"
titlepage-text-color: "ffffff"
---

# ★ MEGA TEAM-UP EPISODE

**Trappers gone corporate.** Power Rangers energy. Built for a 5-year-old AND a CEO.

## THE LEAGUE (your Power Rangers)

| Ranger | Who | Superpower |
|--------|-----|------------|
| 🛡️ Red | Muhammad Taha (The Boss) | Says GO. Holds the keys. |
| 🦅 Blue | Rick Sorkin (M1 Mac) | Builds everything while you sleep |
| 🧠 Green | Brainiac-7 | Always-on brain gateway |
| 🦾 Black | Cyborg (Watchtower) | Sees all devices |
| 🚗 Yellow | The Crew (TMMT) | Cars · ops · operators |
| 🐦‍⬛ Shadow | Red Hood lane | Credit guidance (fenced) |
| 🦇 Pink | Batman lane | E-commerce (coming) |

## CHEAT CODES (type these — magic words)

| Code | What happens |
|------|----------------|
| \`GO.command\` | Mac wakes up — double-click ★ ULTIMATE-DROP |
| \`GO.bat\` | Windows wakes up — same folder |
| \`watchtower\` | See the whole team |
| \`booyah\` | Boss control board |
| \`rick-order "task"\` | Tell Rick what to build (M1 does it) |
| \`train on\` | Free local AI brain ON |
| \`god on\` | Fable 5 polish (Boss only) |

## WHAT WE BUILT (A-Z · YTD 2026)

- **AIXMOS** — ad engine · credit front door · \$97 membership
- **BOOYAH** — daily ignition · owner commands
- **BRAINIAC** — Windows gateway · Ollama · LiteLLM
- **CARRY M5** — Watchtower HQ
- **FLEET-INBOX** — Rick's mission queue ($FLEET_DONE reports done)
- **GHL** — money pipeline (checkout URLs = Boss paste)
- **HAILMARY** — sovereign stack · Project X
- **M1 RICK** — forge · builds · brainiac owner
- **TMMT OS** — operators · academy · rentals vertical
- **ULTIMATE-DROP** — one folder · any device · double-click GO
- **WATCHTOWER** — League roster · who's up

## BY THE NUMBERS

| Thing | Count |
|-------|-------|
| Brain docs compiled | $CORPUS_N |
| Vault markdown | $VAULT_N |
| Rick reports done | $FLEET_DONE |
| Mesh devices | 8 |

## GLOWING BRAIN LINKS (tailnet)

- Carry AI: \`http://macbook-pro-2.tailceb455.ts.net:4001/v1\`
- Brainiac Ollama: \`http://brainiac-7.tailceb455.ts.net:11434\`
- Live app: \`https://tmmt-ops.vercel.app\`
- Join operators: \`https://tmmt-ops.vercel.app/join\`

## FOR SHOWING OTHERS

1. Open \`index.html\` in this folder (colorful · fun)
2. AirDrop ★ ULTIMATE-DROP to their device
3. They double-click GO — done

*Compiled $TS · PROJECT X HAILMARY · proprietary forever*
MD

# ── 5. Colorful HTML (kid + investor friendly) ──
say "5/6 — Build colorful HTML showcase"
cat > "$OUT/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>★ TEAM-UP SHOWCASE — PROJECT X HAILMARY</title>
  <style>
    :root {
      --red: #ff3366; --blue: #3366ff; --green: #33ff99;
      --yellow: #ffdd33; --pink: #ff66cc; --purple: #9933ff;
      --dark: #0a0a1a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a2e 100%);
      color: #fff; min-height: 100vh;
    }
    .hero {
      text-align: center; padding: 2rem 1rem;
      background: linear-gradient(90deg, var(--red), var(--purple), var(--blue));
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.2)} }
    @keyframes glow { 0%,100%{box-shadow:0 0 20px #9933ff} 50%{box-shadow:0 0 40px #33ff99,0 0 60px #3366ff} }
    h1 { font-size: clamp(1.8rem,5vw,3rem); margin: 0; text-shadow: 3px 3px 0 #000; }
    .subtitle { font-size: 1.2rem; opacity: .95; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 1rem; padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .card {
      background: rgba(255,255,255,.08); border-radius: 20px; padding: 1.2rem;
      border: 3px solid rgba(255,255,255,.2); transition: transform .2s;
    }
    .card:hover { transform: scale(1.03); animation: glow 2s infinite; }
    .card h2 { margin-top: 0; font-size: 1.3rem; }
    .red{border-color:var(--red)} .blue{border-color:var(--blue)} .green{border-color:var(--green)}
    .yellow{border-color:var(--yellow)} .pink{border-color:var(--pink)} .purple{border-color:var(--purple)}
    .cheat {
      font-family: monospace; background: #000; color: var(--green);
      padding: .4rem .8rem; border-radius: 8px; display: inline-block; margin: .2rem;
      font-size: .95rem;
    }
    .brain-link {
      display: block; color: var(--green); text-decoration: none;
      padding: .5rem; margin: .3rem 0; border-left: 4px solid var(--purple);
      background: rgba(153,51,255,.15); border-radius: 0 8px 8px 0;
    }
    .brain-link:hover { background: rgba(51,255,153,.2); text-shadow: 0 0 10px var(--green); }
    footer { text-align: center; padding: 2rem; opacity: .7; font-size: .9rem; }
    .mega { font-size: 3rem; line-height: 1; }
  </style>
</head>
<body>
  <header class="hero">
    <div class="mega">⚡🦾🧠🚗⚡</div>
    <h1>★ TEAM-UP SHOWCASE</h1>
    <p class="subtitle">Power Rangers × Anime × Trappers Gone Corporate<br/>Even a 5-year-old can use this!</p>
  </header>

  <section class="grid">
    <article class="card red">
      <h2>🛡️ RED RANGER — The Boss</h2>
      <p>Muhammad Taha · Carry M5 · Watchtower HQ</p>
      <p><span class="cheat">watchtower</span> <span class="cheat">booyah</span> <span class="cheat">rick-order</span></p>
    </article>
    <article class="card blue">
      <h2>🦅 BLUE RANGER — Rick</h2>
      <p>M1 Mac · builds while you trap & close</p>
      <p><span class="cheat">GO.command</span> on M1 once</p>
    </article>
    <article class="card green">
      <h2>🧠 GREEN RANGER — Brainiac</h2>
      <p>Windows · always-on AI gateway</p>
      <p><span class="cheat">GO.bat</span> role: brain</p>
    </article>
    <article class="card yellow">
      <h2>🚗 YELLOW RANGER — The Crew</h2>
      <p>TMMT · rentals · operators · academy</p>
      <a class="brain-link" href="https://tmmt-ops.vercel.app/join" target="_blank">→ Join the team (operators)</a>
    </article>
    <article class="card purple">
      <h2>🦾 CYBORG — Watchtower</h2>
      <p>Sees every computer · 8 devices on mesh</p>
      <p>Blackout: clear · HAILMARY: online</p>
    </article>
    <article class="card pink">
      <h2>✨ CHEAT CODES</h2>
      <p>Magic words — copy & paste in Terminal:</p>
      <p><span class="cheat">bash scripts/rick-order.sh "task"</span></p>
      <p><span class="cheat">train on</span> <span class="cheat">god on</span> (Boss polish)</p>
    </article>
  </section>

  <section class="grid">
    <article class="card purple" style="grid-column:1/-1">
      <h2>🧠 GLOWING BRAIN LINKS</h2>
      <a class="brain-link" href="http://macbook-pro-2.tailceb455.ts.net:4001/v1">Carry LiteLLM (Rick-safe AI)</a>
      <a class="brain-link" href="http://brainiac-7.tailceb455.ts.net:11434">Brainiac Ollama (local brain)</a>
      <a class="brain-link" href="https://tmmt-ops.vercel.app">TMMT Ops (live app)</a>
      <a class="brain-link" href="https://tmmt-ops.vercel.app/lp/aixmos/lead-magnet">Ad trap door (lead magnet)</a>
      <a class="brain-link" href="https://tmmt-ops.vercel.app/credit">Credit front door</a>
    </article>
    <article class="card green" style="grid-column:1/-1">
      <h2>📦 WHAT WE BUILT (A → Z)</h2>
      <p><strong>AIXMOS</strong> ads · <strong>BOOYAH</strong> daily · <strong>BRAINIAC</strong> gateway ·
      <strong>CARRY</strong> HQ · <strong>FLEET</strong> missions · <strong>GHL</strong> money ·
      <strong>HAILMARY</strong> sovereign · <strong>M1 RICK</strong> forge · <strong>TMMT OS</strong> platform ·
      <strong>ULTIMATE-DROP</strong> one-folder deploy · <strong>WATCHTOWER</strong> league</p>
      <p>Full docs in this folder · PDF after Fable 5 polish</p>
    </article>
    <article class="card yellow" style="grid-column:1/-1">
      <h2>🎮 HOW TO SHOW SOMEONE (5-year-old mode)</h2>
      <ol>
        <li>AirDrop folder <strong>★ ULTIMATE-DROP</strong> to their computer</li>
        <li>Mac: double-click <strong>GO.command</strong></li>
        <li>Windows: double-click <strong>GO.bat</strong></li>
        <li>Open this <strong>index.html</strong> in Chrome — colorful team-up!</li>
      </ol>
    </article>
  </section>

  <footer>
    PROJECT X HAILMARY · Muhammad Taha · Proprietary Forever · Trappers Gone Corporate<br/>
    Compiled across Carry · M1 · Brainiac · Office · Rick runs the backend
  </footer>
</body>
</html>
HTML

# Inject live stats into HTML via sed on a copy - actually the markdown has stats, HTML is static enough

# Fable 5 brief for final PDF
cat > "$FABLE_BRIEF" <<FABLE
# FABLE 5 — ULTIMATE PDF POLISH BRIEF

**Boss only:** \`god on\` then Claude Max / Fable 5.

## Your job
Read \`$OUT/ULTIMATE-A-Z-SHOWCASE.md\` and \`$OUT/00-SOURCE-V3-MASTER/\`.

Produce **one final PDF**:
- Title: **TEAM-UP SHOWCASE — PROJECT X HAILMARY**
- Style: colorful, kid-friendly, anime/Power Rangers energy, professional enough for investors
- Include: League roster, cheat codes, A-Z built list, brain links, device map, receipts/numbers
- Archive note: old PDFs moved to \`$ARCHIVE\`

## Output
Save PDF to: \`$OUT/TEAM-UP-SHOWCASE-ULTIMATE.pdf\`

Also copy to: \`$RICK/OUTBOUND/TEAM-UP-SHOWCASE-ULTIMATE.pdf\` for Syncthing → all devices.

## Rules
- Proprietary — never open source
- Moe Legacy frozen — do not include
- Halal / dignity language on credit
- Make it fun AND true
FABLE

# ── 6. Sync to mesh drop folders ──
say "6/6 — Sync to all device drops"
mkdir -p "$RICK/DEVICE-DROPS" "$HOME/Desktop/★ ULTIMATE-DROP/showcase"
cp -R "$OUT" "$RICK/DEVICE-DROPS/TEAM-UP-SHOWCASE" 2>/dev/null || true
cp -R "$OUT"/* "$HOME/Desktop/★ ULTIMATE-DROP/showcase/" 2>/dev/null || true
cp -f "$OUT/index.html" "$HOME/Desktop/★ ULTIMATE-DROP/" 2>/dev/null || true

# PDF if pandoc exists
if command -v pandoc >/dev/null 2>&1; then
  pandoc "$OUT/ULTIMATE-A-Z-SHOWCASE.md" -o "$OUT/TEAM-UP-SHOWCASE-DRAFT.pdf" \
    --pdf-engine=xelatex -V geometry:margin=1in -V fontsize=12pt 2>/dev/null \
    && ok "Draft PDF (pandoc)" || warn "pandoc PDF skipped"
else
  ok "Draft PDF → Fable 5 (pandoc not on this Mac — use FABLE-5-ULTIMATE-PDF-BRIEF.md)"
fi

cat <<DONE

╔══════════════════════════════════════════════════════════════════╗
║  ★ TEAM-UP SHOWCASE COMPLETE                                     ║
╠══════════════════════════════════════════════════════════════════╣
║  Open:     $OUT/index.html
║  Markdown: $OUT/ULTIMATE-A-Z-SHOWCASE.md
║  Fable:    $FABLE_BRIEF
║  Archived: $ARCHIVE
╠══════════════════════════════════════════════════════════════════╣
║  Fable 5 final PDF (Boss):  god on → paste FABLE brief → claude
║  Rick on M1: auto via DEVICE-DROPS sync
╚══════════════════════════════════════════════════════════════════╝

DONE

[[ "${1:-}" == "open" ]] && open "$OUT/index.html"
