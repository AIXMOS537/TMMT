# 21 · MOBILE / TABLET AUDIT

**Method:** static only. The app was **not** rendered on a device or emulator (read-only audit, no production session). Findings are from code; visual confirmation is **UNKNOWN**.

## Evidence of mobile intent — genuinely good
- **PWA:** `manifest.webmanifest` in the middleware public list, dedicated `/offline` route, `src/lib/offline/` (store, tables, `desk-save`), `/api/offline/merge`. Reads fall back to cache when `isBrowserOffline()`.
- **Tailwind 4** — responsive utility classes throughout; dark mode from the earliest commits.
- **`(pocket)` route group** (7 routes) — explicitly a phone-first surface (academy, assistant, climb, compass, earn).
- **`/clock`** — a time-clock screen, inherently mobile.

## Risks (static)
| Surface | Concern |
|---|---|
| `DataTable` across 27 `(admin)` routes | Wide tables are the classic mobile failure; no evidence of a card/stacked fallback |
| `KanbanBoard` + `@dnd-kit` | Drag-and-drop on touch needs explicit sensor config; unverified |
| `DetailPanel` | Side panels need full-screen treatment on phones |
| Leaflet maps (`/dispatch`) | Touch gestures vs page scroll conflict |
| 17 `/forms/*` routes | The most likely real mobile usage — inspections and handovers happen **at the car** |
| **Camera / photo capture** | 🔴 **Absent.** `/forms/onboarding-inspection` explicitly instructs: *"Photos should be taken separately and uploaded to the vehicle's record"* |

## The one that matters
**A rental business runs its inspections and handovers on a phone, in a parking lot.** `/forms/inspection`, `/forms/onboarding-inspection`, `/forms/handover` and `/forms/license-upload` are the screens that will carry real mobile load — and the photo workflow, which is the entire evidentiary point of a vehicle inspection, is **manual and out-of-band**.

`vehicle_media` = 0 rows. `customer_inspection_photos` = 1 row. There is effectively no photographic condition record.

**Recommendation:** when rental operations restart, in-form camera capture straight to Supabase Storage is a **higher-value build than anything in the platform/tenancy backlog.** Undocumented damage is a direct, recurring cash loss on every return.

## Not assessed
Touch-target sizing, viewport behaviour, real device performance, tablet layouts — all require running the app. Deferred to a live session.
