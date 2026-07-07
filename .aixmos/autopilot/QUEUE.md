# AUTOPILOT QUEUE — drop work here; the loop does it, one item per run

Add tasks as `- [ ] …` lines under TODO. Keep each one small, safe, and non-gated
(the autopilot will skip anything gated/live/money and note it below). The loop reads
the top unchecked TODO item; when it finishes one it moves it to DONE with a date.
If the queue is empty, the loop falls back to `PLAN.md` for the next safe item.

Owner controls:
- Pause everything: `touch .swarm/DARK` (autopilot honors the kill-switch).
- Resume: remove that file (`bash scripts/godark lift` if wired).

## TODO
- [ ] (example — delete me) Add a unit test for an untested pure helper in `src/lib/`.
- [ ] (example — delete me) Improve a doc comment or README section that's stale.

## NEEDS OWNER (autopilot parks things here — do not auto-do)
- Turn on money collection (GHL checkout links) — money + live surface.
- Any WS2 credit/funding work — legally gated until attorney sign-off.
- Apply Supabase migrations to the real DB.

## DONE
<!-- autopilot appends completed items here with a date -->
