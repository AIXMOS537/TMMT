# Maintenance Show/No-Show Toggle — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Problem

VAs and owners need to quickly mark maintenance appointments as No-Show or Late without opening the edit modal. Currently the only way to change status is through the modal — too slow for rapid bulk updates.

## Solution

Replace the static `StatusBadge` in the maintenance table's Status column with a clickable `StatusPill` component. Clicking it opens an inline dropdown of all status options. Selecting No-Show or Late automatically sets a configurable fee and saves immediately.

## Behavior

- Clicking the status pill opens a dropdown with: `Scheduled`, `Completed`, `No-Show`, `Late`, `Cancelled`
- Selecting any status saves immediately via `supabase.update()` — no modal required
- Selecting **No-Show** or **Late** also sets `fee_assessed_if_no_show_late = NO_SHOW_FEE`
- Any other status saves only the status field (fee is not touched)
- Dropdown closes on selection or outside click
- The full modal remains available for editing all other fields

## Fee Configuration

```ts
const NO_SHOW_FEE = 50 // dollars — change as needed
```

Defined at the top of `maintenance/page.tsx`. Not stored in the database as config — just a code constant for now.

## Components

### New: `StatusPill` in `src/components/ui.tsx`

A self-contained clickable badge that manages its own open/close state.

```ts
interface StatusPillProps {
  status: string
  options: string[]
  onChange: (newStatus: string) => void
}
```

- Renders current status styled like `StatusBadge`
- On click: renders a positioned dropdown list of `options`
- On option select: calls `onChange(newStatus)`, closes dropdown
- On outside click: closes dropdown (via `useEffect` + `mousedown` listener)

### Updated: `src/app/(admin)/maintenance/page.tsx`

- Add `const NO_SHOW_FEE = 50` constant
- Add `handleStatusChange(id: unknown, newStatus: string)` async function:
  - Builds update payload: always includes `status`
  - If `newStatus === "No-Show" || newStatus === "Late"`: adds `fee_assessed_if_no_show_late: NO_SHOW_FEE`
  - Calls `supabase.from("maintenance_appointments").update(payload).eq("id", id)`
  - Calls `load()` on success, `alert(error.message)` on error
- Replace status column render from `<StatusBadge>` to `<StatusPill>` wired to `handleStatusChange`

## Scope

- **Files changed:** `src/components/ui.tsx`, `src/app/(admin)/maintenance/page.tsx`
- **Schema changes:** None
- **New dependencies:** None

## Out of Scope

- Fee notification to customer (existing `was_customer_notified_of_fee` field stays manual)
- Configurable fee per appointment type
- Undo/confirmation dialog
