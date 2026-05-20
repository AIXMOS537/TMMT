# AIXMOS × TMMT — Rubik's Cube (production)

Two faces, one deployment, one Supabase core.

## Production URLs (same origin)

| Face | Path | Example |
|------|------|---------|
| Learn | `/learn/*` | `https://aixmos.com/learn/onboarding` |
| Work | `/work/*` | `https://aixmos.com/work/program` |
| Fleet | `/fleet` | TMMT rentals ops |
| Command | `/command` | Owner hub |

Set in Vercel:

```bash
NEXT_PUBLIC_CUBE_SAME_ORIGIN=true
NEXT_PUBLIC_CUBE_PERSISTENCE=supabase
NEXT_PUBLIC_AIXMOS_SITE_URL=https://aixmos.com
```

## Database

Apply migration:

```bash
supabase db push
# or run supabase/migrations/20260520120000_aixmos_program_cube.sql
```

Tables: `program_applications`, `program_audit_log` (Realtime enabled).

## GHL → Learn deep link

**Endpoint:** `POST /api/webhooks/ghl/program`  
**Also:** main `POST /api/webhooks/ghl` forwards when tag includes `ready-for-aixmos`.

Header: `x-ghl-webhook-secret: $GHL_WEBHOOK_SECRET`

```json
{
  "email": "client@example.com",
  "first_name": "Jordan",
  "last_name": "Rivera",
  "contact_id": "ghl_123",
  "tags": ["ready-for-aixmos"]
}
```

**Response:**

```json
{
  "ok": true,
  "applicationId": "uuid",
  "learnUrl": "https://aixmos.com/learn/onboarding?applicationId=uuid&token=..."
}
```

Send `learnUrl` in GHL SMS/email workflow.

## Sync

- **Production:** Supabase Realtime on `program_applications` (replaces BroadcastChannel).
- **Local demo without DB:** `NEXT_PUBLIC_CUBE_PERSISTENCE=local` (localStorage + BroadcastChannel).

## Dev

```bash
cd /Users/ceo.moe/TMMT
npm install
npm run dev              # unified — http://localhost:3000/learn + /work
npm run dev:cube         # split — Learn :3001, Work :3000
```

## Packages

- `packages/aixmos-core` — status machine, engines, cube shell, persistence
- `apps/engine` — optional standalone Learn dev server
- `src/app/(learn)` — production Learn routes
- `src/app/(program)/work` — workforce face

Standalone `/Users/ceo.moe/dev/aixmos` is retired — see `dev/aixmos/README.md`.
