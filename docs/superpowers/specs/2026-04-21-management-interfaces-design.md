# Management Interfaces Design Spec

**Date:** 2026-04-21
**Status:** Approved
**Scope:** 4 Airtable-style management interfaces — Appointments, Contracts, Vehicles, Payments

## Overview

Recreate the 4 Airtable "Interfaces" as rich dashboard-style views in the TMMT admin panel. Each interface provides summary metrics with charts, multiple view types (table, calendar/kanban), linked related data in detail panels, and drag-and-drop status management.

These are **new pages alongside the existing admin pages** (Approach B) — the existing data pages remain untouched for quick edits.

## Architecture

### New Routes

```
src/app/(admin)/interfaces/
  appointments/page.tsx
  contracts/page.tsx
  vehicles/page.tsx
  payments/page.tsx
```

### Sidebar

Add an "Interfaces" group to the sidebar with 4 links, visually separated from the existing data pages.

### New Dependencies

| Package | Purpose |
|---------|---------|
| `recharts` | Charting (bar, line, pie) |
| `@dnd-kit/core` | Drag-and-drop core |
| `@dnd-kit/sortable` | Sortable primitives for Kanban |

### Shared Components

New reusable components in `src/components/`:

| Component | Description |
|-----------|-------------|
| **ChartCard** | Thin wrappers around recharts (`BarChart`, `PieChart`, `LineChart`) with consistent styling and dark mode support. Rendered inside a card container. |
| **KanbanBoard** | Generic drag-and-drop board using `@dnd-kit/core`. Columns defined by status values. Cards show key fields + linked info. Dropping a card calls `adminUpsert()` to update status with a confirmation prompt. |
| **CalendarView** | Custom-built monthly grid + weekly time-slot view with toggle. Events are clickable. No heavy calendar library — Tailwind grid of days/hours. |
| **DetailPanel** | Slide-over panel (right side) showing a record with inline related data and navigation links to other interfaces. Replaces modal for interface pages. |
| **ViewSwitcher** | Tab bar to toggle between Dashboard / Table / Calendar or Kanban views. Persists selection in URL search params. |

### Data Layer

New query functions in `queries.ts` (read-only):

- `getAppointmentStats()` — counts by status, by day (current week), completion/no-show rates
- `getContractStats()` — counts by status, expiring this week, signed over time (6 months)
- `getVehicleStats()` — counts by status, revenue per vehicle (top 10)
- `getPaymentStats()` — total collected (month), pending, overdue, by method, revenue over time (6 months)
- `getVehicleDetail(id)` — vehicle + current renter + active contract + recent payments + recent maintenance (joined)
- `getContractDetail(id)` — contract + customer + vehicle + last payment (joined)
- `getAppointmentDetail(id)` — appointment + customer info (joined)
- `getPaymentDetail(id)` — payment + customer + vehicle + contract (joined)

All writes continue through `adminUpsert()` in `admin-actions.ts`.

---

## Interface 1: Appointment Management

**Route:** `/interfaces/appointments`

### Dashboard Tab

- **Stat cards:** Appointments Today, This Week, Completion Rate, No-Show Rate
- **Bar chart:** Appointments per day (current week)
- **Pie chart:** Status distribution (Scheduled / Completed / Cancelled / No-Show)

### Calendar Tab

- **Monthly grid:** Each day cell shows appointment count + colored dots by status
- **Weekly view:** Time slots with appointment blocks showing customer name + type
- **Toggle:** Switch between monthly and weekly
- **Click:** Opens detail panel for the appointment

### Table Tab

- Same data table as existing appointments page (search, status filter, sortable columns)

### Detail Panel (slide-over)

- Appointment info: date/time, type, status
- Inline related: customer name, phone, email
- Links: click customer name → customer record
- Edit form + status change buttons ("Mark Completed", "Mark No-Show")

---

## Interface 2: Contract Management

**Route:** `/interfaces/contracts`

### Dashboard Tab

- **Stat cards:** Active Contracts, Expiring This Week, Draft (unsigned), Terminated This Month
- **Line chart:** Contracts signed over time (past 6 months)
- **Pie chart:** Status distribution (Draft / Signed / Active / Completed / Terminated)

### Kanban Tab

- **Columns:** Draft → Signed → Active → Completed → Terminated
- **Cards show:** customer name, vehicle name, start/end dates
- **Drag-and-drop:** Changes status with confirmation prompt (e.g., "Move to Terminated?")
- **Click:** Opens detail panel

### Table Tab

- Same as existing contracts page (search, status filter, sortable)

### Detail Panel (slide-over)

- Contract info: type, status, start/end dates
- Inline related: customer name + phone, assigned vehicle + plate number, last payment date + amount
- Links: customer → customer record, vehicle → vehicle interface
- Edit form + quick status actions

---

## Interface 3: Vehicle Management

**Route:** `/interfaces/vehicles`

### Dashboard Tab

- **Stat cards:** Total Fleet, Available, Rented, Under Maintenance, Needs Repair
- **Pie chart:** Fleet status distribution
- **Bar chart:** Revenue per vehicle (top 10, based on payment data)

### Kanban Tab

- **Columns:** Available → Rented → Under Maintenance → Needs Repair → Retired
- **Cards show:** vehicle name (year make model), license plate, color dot, weekly rate
- **Drag-and-drop:** Changes status with confirmation. "Rented" requires extra confirmation since it implies customer assignment.
- **Click:** Opens detail panel

### Table Tab

- Same as existing fleet page (search, status filter, sortable)

### Detail Panel (slide-over)

- Vehicle info: year, make, model, VIN, license plate, color, odometer, weekly rate, status
- Inline related: current renter (name + phone), active contract (status + end date), last payment (date + amount), recent maintenance (last 3 records)
- Links: customer → customer record, contract → contract interface, "view all maintenance" → maintenance page
- Edit form + quick status actions

---

## Interface 4: Payment Management

**Route:** `/interfaces/payments`

### Dashboard Tab

- **Stat cards:** Total Collected (this month), Pending, Overdue, Average Payment Amount
- **Line chart:** Revenue collected over time (past 6 months, monthly)
- **Bar chart:** Payments by method (Cash / Card / Zelle / etc.)
- **Pie chart:** Status distribution (Paid / Pending / Overdue)

### Kanban Tab

- **Columns:** Pending → Paid → Overdue
- **Cards show:** customer name, amount, payment date, method
- **Drag-and-drop:** Changes status (e.g., mark Pending as Paid)
- **Click:** Opens detail panel

### Table Tab

- Same as existing payments page (search, status filter, sortable)

### Detail Panel (slide-over)

- Payment info: amount, date, method, status
- Inline related: customer name + phone, associated vehicle, associated contract (status + dates)
- Links: customer → customer record, vehicle → vehicle interface, contract → contract interface
- Edit form + quick status actions ("Mark Paid", "Mark Overdue")

---

## UI/UX Patterns

### View Switcher
- Tab bar at top of each interface page: **Dashboard | Table | Calendar** (appointments) or **Dashboard | Table | Kanban** (contracts, vehicles, payments)
- Active tab stored in URL search params (`?view=dashboard`) for shareability and back-button support

### Detail Panel
- Slide-over from the right (not a centered modal)
- Width: ~480px on desktop, full-width on mobile
- Sections: header (name + status badge), related data cards, edit form
- Close via X button, Escape key, or clicking outside

### Kanban Cards
- Compact: 2-3 lines of key info
- Status-colored left border
- Drag handle on hover
- Confirmation dialog on drop (especially for destructive transitions like "Terminated" or "Retired")

### Calendar
- Monthly: 7-column grid, day cells with event dots/counts
- Weekly: 7-column × 12-row (hourly) grid, appointments render as fixed-height blocks at their scheduled hour (no duration data in schema)
- Navigation: prev/next arrows + "Today" button
- Current day highlighted

### Charts
- All charts respect dark mode (background, text, grid colors from Tailwind theme)
- Tooltips on hover
- Responsive — stack vertically on smaller screens
- Consistent color palette across all interfaces

### Responsive Behavior
- Desktop: full layout with side-by-side stat cards and charts
- Tablet: stat cards wrap to 2 columns, charts stack
- Mobile: single column, calendar switches to list view, Kanban scrolls horizontally

---

## Database Considerations

### Junction Tables for Related Data

The database has junction tables that enable related data queries:
- `fleet_active_customers` — vehicle ↔ customer
- `active_customers_payments` — customer ↔ payments
- `active_customers_contracts` — customer ↔ contracts
- `fleet_contracts` — vehicle ↔ contracts
- `fleet_payments` — vehicle ↔ payments

These will be used for the detail panel joined queries. All queries go through the Supabase anon client with RLS policies already in place.

### No Schema Changes

No new tables or columns needed. All data already exists — this is purely a presentation layer change.
