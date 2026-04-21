# Management Interfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 4 Airtable-style management interfaces (Appointments, Contracts, Vehicles, Payments) with dashboard metrics, charts, calendar/kanban views, drag-and-drop, and linked detail panels.

**Architecture:** New routes under `src/app/(admin)/interfaces/` alongside existing pages. Shared components for charts, kanban, calendar, detail panel, and view switching. New aggregation queries in `queries.ts`. All writes through existing `adminUpsert()`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, recharts, @dnd-kit/core + @dnd-kit/sortable, Supabase

**Spec:** `docs/superpowers/specs/2026-04-21-management-interfaces-design.md`

---

## File Structure

### New Files
```
src/components/charts.tsx          — ChartCard wrappers (BarChart, PieChart, LineChart) with dark mode
src/components/ViewSwitcher.tsx    — Tab bar for Dashboard/Table/Calendar|Kanban views
src/components/DetailPanel.tsx     — Slide-over panel for record details + related data + edit form
src/components/KanbanBoard.tsx     — Generic drag-and-drop kanban using @dnd-kit
src/components/CalendarView.tsx    — Monthly grid + weekly time-slot view with toggle
src/app/(admin)/interfaces/appointments/page.tsx
src/app/(admin)/interfaces/contracts/page.tsx
src/app/(admin)/interfaces/vehicles/page.tsx
src/app/(admin)/interfaces/payments/page.tsx
```

### Modified Files
```
src/lib/queries.ts                 — Add aggregation + joined detail queries
src/components/Sidebar.tsx         — Add "Interfaces" nav group
package.json                       — Add recharts, @dnd-kit/core, @dnd-kit/sortable
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts and dnd-kit**

```bash
npm install recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts and @dnd-kit dependencies for management interfaces"
```

---

## Task 2: Build ChartCard Components

**Files:**
- Create: `src/components/charts.tsx`

- [ ] **Step 1: Create charts.tsx with BarChartCard, PieChartCard, LineChartCard**

```tsx
"use client";

import { ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

function ChartWrapper({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">
        {title}
      </h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

export function BarChartCard({
  title,
  data,
  dataKey,
  nameKey = "name",
  color = COLORS[0],
}: {
  title: string;
  data: { name: string; value: number }[];
  dataKey?: string;
  nameKey?: string;
  color?: string;
}) {
  return (
    <ChartWrapper title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey={nameKey}
            tick={{ fontSize: 12 }}
            stroke="#94a3b8"
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-slate-800, #1e293b)",
              border: "1px solid var(--color-slate-700, #334155)",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
          />
          <Bar dataKey={dataKey ?? "value"} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function PieChartCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  return (
    <ChartWrapper title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-slate-800, #1e293b)",
              border: "1px solid var(--color-slate-700, #334155)",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function LineChartCard({
  title,
  data,
  dataKey = "value",
  nameKey = "name",
  color = COLORS[0],
}: {
  title: string;
  data: { name: string; value: number }[];
  dataKey?: string;
  nameKey?: string;
  color?: string;
}) {
  return (
    <ChartWrapper title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey={nameKey}
            tick={{ fontSize: 12 }}
            stroke="#94a3b8"
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-slate-800, #1e293b)",
              border: "1px solid var(--color-slate-700, #334155)",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts.tsx
git commit -m "feat: add ChartCard components (bar, pie, line) with dark mode support"
```

---

## Task 3: Build ViewSwitcher Component

**Files:**
- Create: `src/components/ViewSwitcher.tsx`

- [ ] **Step 1: Create ViewSwitcher.tsx**

```tsx
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ViewTab = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

export function ViewSwitcher({
  tabs,
  defaultTab,
}: {
  tabs: ViewTab[];
  defaultTab?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = searchParams.get("view") ?? defaultTab ?? tabs[0]?.key;

  function setView(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 p-1 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setView(tab.key)}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
            activeView === tab.key
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function useActiveView(defaultTab: string): string {
  const searchParams = useSearchParams();
  return searchParams.get("view") ?? defaultTab;
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ViewSwitcher.tsx
git commit -m "feat: add ViewSwitcher component with URL-persisted tab state"
```

---

## Task 4: Build DetailPanel Component

**Files:**
- Create: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Create DetailPanel.tsx**

```tsx
"use client";

import { ReactNode, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function DetailPanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-lg transform overflow-y-auto border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: ReactNode;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500 dark:text-slate-400">{label}</span>
      {href ? (
        <a
          href={href}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
          {value}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: add DetailPanel slide-over with DetailSection and DetailRow helpers"
```

---

## Task 5: Build KanbanBoard Component

**Files:**
- Create: `src/components/KanbanBoard.tsx`

- [ ] **Step 1: Create KanbanBoard.tsx**

```tsx
"use client";

import { useState, ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { statusColor } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────── */

export type KanbanItem = {
  id: string;
  status: string;
  [key: string]: unknown;
};

type KanbanColumn = {
  key: string;
  label: string;
};

/* ── Droppable Column ──────────────────────────────────────── */

function Column({
  column,
  items,
  renderCard,
  onCardClick,
}: {
  column: KanbanColumn;
  items: KanbanItem[];
  renderCard: (item: KanbanItem) => ReactNode;
  onCardClick?: (item: KanbanItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      className={cn(
        "flex w-72 flex-shrink-0 flex-col rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50",
        isOver && "ring-2 ring-blue-400"
      )}
    >
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          {column.label}
        </h3>
        <span className="rounded-full bg-gray-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-400">
          {items.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto p-3" style={{ minHeight: 100 }}>
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              onClick={() => onCardClick?.(item)}
            >
              {renderCard(item)}
            </SortableCard>
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

/* ── Sortable Card ─────────────────────────────────────────── */

function SortableCard({
  item,
  children,
  onClick,
}: {
  item: KanbanItem;
  children: ReactNode;
  onClick?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      {children}
    </div>
  );
}

/* ── KanbanBoard (exported) ────────────────────────────────── */

export function KanbanBoard({
  columns,
  items,
  renderCard,
  onStatusChange,
  onCardClick,
}: {
  columns: KanbanColumn[];
  items: KanbanItem[];
  renderCard: (item: KanbanItem) => ReactNode;
  onStatusChange: (itemId: string, newStatus: string, oldStatus: string) => Promise<boolean>;
  onCardClick?: (item: KanbanItem) => void;
}) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    // Determine target column — over.id could be a column key or another card's id
    let targetStatus: string | null = null;

    // Check if dropped on a column
    if (columns.some((c) => c.key === over.id)) {
      targetStatus = over.id as string;
    } else {
      // Dropped on a card — find which column that card belongs to
      const targetItem = items.find((i) => i.id === over.id);
      if (targetItem) targetStatus = targetItem.status;
    }

    if (!targetStatus || targetStatus === item.status) return;

    const confirmed = window.confirm(
      `Move to "${columns.find((c) => c.key === targetStatus)?.label ?? targetStatus}"?`
    );
    if (!confirmed) return;

    await onStatusChange(item.id, targetStatus, item.status);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <Column
            key={col.key}
            column={col}
            items={items.filter((i) => i.status === col.key)}
            renderCard={renderCard}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-lg border border-blue-300 bg-white dark:bg-slate-800 p-3 shadow-lg opacity-90">
            {renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/KanbanBoard.tsx
git commit -m "feat: add KanbanBoard component with drag-and-drop status changes"
```

---

## Task 6: Build CalendarView Component

**Files:**
- Create: `src/components/CalendarView.tsx`

- [ ] **Step 1: Create CalendarView.tsx**

```tsx
"use client";

import { useState, useMemo, ReactNode } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  getHours,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────── */

export type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  status?: string;
  [key: string]: unknown;
};

type CalendarMode = "month" | "week";

const STATUS_DOT_COLORS: Record<string, string> = {
  Scheduled: "bg-amber-400",
  Completed: "bg-emerald-400",
  Cancelled: "bg-gray-400",
  "No-Show": "bg-red-400",
};

/* ── CalendarView (exported) ───────────────────────────────── */

export function CalendarView({
  events,
  onEventClick,
  renderEventTooltip,
}: {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  renderEventTooltip?: (event: CalendarEvent) => ReactNode;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>("month");

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setCurrentDate(
                mode === "month"
                  ? subMonths(currentDate, 1)
                  : subWeeks(currentDate, 1)
              )
            }
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 dark:text-slate-400"
          >
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 min-w-[160px] text-center">
            {mode === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}
          </h3>
          <button
            onClick={() =>
              setCurrentDate(
                mode === "month"
                  ? addMonths(currentDate, 1)
                  : addWeeks(currentDate, 1)
              )
            }
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 dark:text-slate-400"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Today
          </button>
        </div>

        <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 p-0.5">
          {(["month", "week"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition",
                mode === m
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
                  : "text-gray-500 dark:text-slate-400"
              )}
            >
              {m === "month" ? "Month" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      {mode === "month" ? (
        <MonthGrid
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
        />
      ) : (
        <WeekGrid
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}

/* ── Month Grid ────────────────────────────────────────────── */

function MonthGrid({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(e.date, day));
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] border-b border-r border-gray-100 dark:border-slate-700/50 p-1.5",
                !isSameMonth(day, currentDate) && "bg-gray-50/50 dark:bg-slate-800/30"
              )}
            >
              <span
                className={cn(
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday(day)
                    ? "bg-blue-600 text-white font-bold"
                    : "text-gray-700 dark:text-slate-300"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 truncate"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        STATUS_DOT_COLORS[ev.status ?? ""] ?? "bg-blue-400"
                      )}
                    />
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block text-[10px] text-gray-400 dark:text-slate-500 px-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Week Grid ─────────────────────────────────────────────── */

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM – 8 PM

function WeekGrid({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="px-2 py-2 text-center">
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">
              {format(day, "EEE")}
            </div>
            <div
              className={cn(
                "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm",
                isToday(day)
                  ? "bg-blue-600 text-white font-bold"
                  : "text-gray-900 dark:text-slate-100"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 dark:border-slate-700/50"
          >
            <div className="px-2 py-3 text-right text-xs text-gray-400 dark:text-slate-500">
              {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            {days.map((day) => {
              const hourEvents = events.filter(
                (e) => isSameDay(e.date, day) && getHours(e.date) === hour
              );
              return (
                <div
                  key={day.toISOString()}
                  className="border-l border-gray-100 dark:border-slate-700/50 p-0.5 min-h-[48px]"
                >
                  {hourEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick?.(ev)}
                      className={cn(
                        "w-full rounded px-1.5 py-1 text-left text-[10px] font-medium truncate",
                        "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",
                        "hover:bg-blue-200 dark:hover:bg-blue-900/60"
                      )}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "feat: add CalendarView component with monthly grid and weekly time-slot views"
```

---

## Task 7: Add Aggregation and Detail Queries

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Add appointment stats query**

Add to the bottom of `queries.ts`:

```typescript
/* ── Interface Aggregation Queries ──────────────────────────── */

export async function getAppointmentStats() {
  const all = await getAppointments() as Record<string, unknown>[];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const today = all.filter(
    (a) => String(a.appointment_date_time ?? "").slice(0, 10) === todayStr
  );
  const thisWeek = all.filter((a) => {
    const d = new Date(String(a.appointment_date_time ?? ""));
    return d >= weekStart && d <= now;
  });
  const completed = all.filter((a) => a.status === "Completed").length;
  const noShow = all.filter((a) => a.status === "No-Show").length;
  const total = all.length || 1;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  all.forEach((a) => {
    const s = String(a.status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Per-day counts for current week
  const dayCounts: { name: string; value: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    dayCounts.push({
      name: dayNames[i],
      value: all.filter(
        (a) => String(a.appointment_date_time ?? "").slice(0, 10) === ds
      ).length,
    });
  }

  return {
    today: today.length,
    thisWeek: thisWeek.length,
    completionRate: Math.round((completed / total) * 100),
    noShowRate: Math.round((noShow / total) * 100),
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    })),
    perDay: dayCounts,
    all,
  };
}

export async function getContractStats() {
  const all = await getContracts() as Record<string, unknown>[];
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const active = all.filter((c) => c.status === "Active").length;
  const draft = all.filter((c) => c.status === "Draft").length;

  const expiringThisWeek = all.filter((c) => {
    if (c.status !== "Active") return false;
    const end = new Date(String(c.end_date ?? ""));
    return end >= now && end <= weekEnd;
  }).length;

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const terminatedThisMonth = all.filter((c) => {
    if (c.status !== "Terminated") return false;
    const d = new Date(String(c.updated_at ?? c.created_at ?? ""));
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  all.forEach((c) => {
    const s = String(c.status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Signed over time (past 6 months)
  const signedOverTime: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    signedOverTime.push({
      name: label,
      value: all.filter((c) => {
        const sd = String(c.signed_date ?? c.created_at ?? "");
        return sd.startsWith(monthStr) && (c.status === "Signed" || c.status === "Active" || c.status === "Completed");
      }).length,
    });
  }

  return {
    active,
    expiringThisWeek,
    draft,
    terminatedThisMonth,
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    })),
    signedOverTime,
    all,
  };
}

export async function getVehicleStats() {
  const fleet = await getFleet() as Record<string, unknown>[];
  const payments = await getPayments() as Record<string, unknown>[];

  const statusCounts: Record<string, number> = {};
  fleet.forEach((v) => {
    const s = String(v.status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Revenue per vehicle (top 10)
  const revenueMap: Record<string, number> = {};
  payments.forEach((p) => {
    const vName = String(p.vehicle ?? p.vehicle_name ?? "Unknown");
    const amt = Number(p.amount) || 0;
    revenueMap[vName] = (revenueMap[vName] || 0) + amt;
  });
  const revenuePerVehicle = Object.entries(revenueMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    total: fleet.length,
    available: statusCounts["Available"] ?? 0,
    rented: statusCounts["Rented"] ?? 0,
    underMaintenance: statusCounts["Under Maintenance"] ?? 0,
    needsRepair: statusCounts["Needs Repair"] ?? 0,
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    })),
    revenuePerVehicle,
    all: fleet,
  };
}

export async function getPaymentStats() {
  const all = await getPayments() as Record<string, unknown>[];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const thisMonthPayments = all.filter((p) => {
    const d = new Date(String(p.last_payment_date ?? p.created_at ?? ""));
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const collected = thisMonthPayments
    .filter((p) => p.payment_status === "Paid")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const pending = all
    .filter((p) => p.payment_status === "Pending")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const overdue = all
    .filter((p) => p.payment_status === "Overdue")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const paidCount = all.filter((p) => p.payment_status === "Paid").length;
  const avgPayment = paidCount > 0
    ? all
        .filter((p) => p.payment_status === "Paid")
        .reduce((s, p) => s + (Number(p.amount) || 0), 0) / paidCount
    : 0;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  all.forEach((p) => {
    const s = String(p.payment_status ?? "Unknown");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // By method
  const methodCounts: Record<string, number> = {};
  all.forEach((p) => {
    const m = String(p.payment_method ?? "Unknown");
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  });

  // Revenue over time (past 6 months)
  const revenueOverTime: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    revenueOverTime.push({
      name: label,
      value: all
        .filter((p) => {
          const pd = String(p.last_payment_date ?? p.created_at ?? "");
          return pd.startsWith(monthStr) && p.payment_status === "Paid";
        })
        .reduce((s, p) => s + (Number(p.amount) || 0), 0),
    });
  }

  return {
    collectedThisMonth: collected,
    pending,
    overdue,
    avgPayment: Math.round(avgPayment),
    statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    })),
    byMethod: Object.entries(methodCounts).map(([name, value]) => ({
      name,
      value,
    })),
    revenueOverTime,
    all,
  };
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add aggregation queries for interface dashboards"
```

---

## Task 8: Update Sidebar with Interfaces Group

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add Interfaces nav group to Sidebar.tsx**

Import the additional icons at the top of the file (alongside existing lucide-react imports):

```typescript
import { LayoutDashboard, CalendarRange, FileText, Car, DollarSign } from "lucide-react";
```

Add a new nav group to the `navGroups` array. Insert it as the **second group** (after "Overview"):

```typescript
{
  label: "Interfaces",
  items: [
    { href: "/interfaces/appointments", label: "Appointments", icon: CalendarRange },
    { href: "/interfaces/contracts", label: "Contracts", icon: FileText },
    { href: "/interfaces/vehicles", label: "Vehicles", icon: Car },
    { href: "/interfaces/payments", label: "Payments", icon: DollarSign },
  ],
},
```

Note: Check the existing icon imports — some of these may already be imported. Only add the ones not already present. The exact icon component names used in the existing `navGroups` should be checked before adding to avoid duplicates.

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Interfaces nav group to sidebar"
```

---

## Task 9: Build Appointment Management Interface

**Files:**
- Create: `src/app/(admin)/interfaces/appointments/page.tsx`

- [ ] **Step 1: Create the appointments interface page**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, BarChart3, Table2, Plus } from "lucide-react";
import { getAppointmentStats } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader,
  StatCard,
  DataTable,
  FilterBar,
  ErrorBanner,
  StatusBadge,
  Button,
  FormField,
  inputClass,
  selectClass,
  Column,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { BarChartCard, PieChartCard } from "@/components/charts";
import { CalendarView, CalendarEvent } from "@/components/CalendarView";

type Appointment = Record<string, unknown>;

const STATUS_OPTIONS = ["Scheduled", "Completed", "Cancelled", "No-Show"];
const TYPE_OPTIONS = [
  "New Customer Pickup",
  "Vehicle Return",
  "Payment",
  "Inspection",
  "Maintenance Drop-off",
  "Other",
];

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
];

export default function AppointmentsInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getAppointmentStats>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getAppointmentStats()
      .then(setStats)
      .catch(() => setError("Failed to load appointments."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Filtered data for table view
  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch =
        !search ||
        [r.customer_name, r.phone, r.email, r.appointment_type].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        );
      const matchStatus =
        !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  // Calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    if (!stats) return [];
    return stats.all
      .filter((a) => a.appointment_date_time)
      .map((a) => ({
        id: String(a.id),
        date: new Date(String(a.appointment_date_time)),
        title: `${a.customer_name ?? "Unknown"} — ${a.appointment_type ?? ""}`,
        status: String(a.status ?? ""),
        ...a,
      }));
  }, [stats]);

  const columns: Column<Appointment>[] = [
    {
      key: "customer_name",
      label: "Customer",
      render: (r) => (
        <span className="font-medium">{String(r.customer_name ?? "—")}</span>
      ),
    },
    { key: "appointment_type", label: "Type" },
    {
      key: "appointment_date_time",
      label: "Date/Time",
      render: (r) => formatDateTime(r.appointment_date_time as string),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status as string} />,
    },
    { key: "phone", label: "Phone" },
  ];

  function openDetail(item: Appointment) {
    setSelected(item);
    setPanelOpen(true);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      record[k] = v || null;
    });
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("appointments", record);
    if (!result.success) {
      setSaving(false);
      setError(result.error);
      return;
    }
    setSaving(false);
    setPanelOpen(false);
    setSelected(null);
    load();
  }

  async function quickStatus(status: string) {
    if (!selected?.id) return;
    setSaving(true);
    const result = await adminUpsert("appointments", {
      id: selected.id,
      status,
    });
    if (!result.success) {
      setError(result.error);
    } else {
      setSelected({ ...selected, status });
      load();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Appointment Management"
        description="Dashboard, calendar, and table views for all appointments"
      />

      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {/* ── Dashboard View ─────────────────────────────────── */}
      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Today" value={stats.today} />
            <StatCard label="This Week" value={stats.thisWeek} />
            <StatCard
              label="Completion Rate"
              value={`${stats.completionRate}%`}
            />
            <StatCard label="No-Show Rate" value={`${stats.noShowRate}%`} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <BarChartCard
              title="Appointments This Week"
              data={stats.perDay}
            />
            <PieChartCard
              title="Status Distribution"
              data={stats.statusDistribution}
            />
          </div>
        </div>
      )}

      {/* ── Table View ─────────────────────────────────────── */}
      {activeView === "table" && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search appointments..."
          >
            <select
              className={selectClass + " sm:w-48"}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterBar>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={openDetail}
          />
        </>
      )}

      {/* ── Calendar View ──────────────────────────────────── */}
      {activeView === "calendar" && (
        <CalendarView
          events={calendarEvents}
          onEventClick={(ev) => openDetail(ev as unknown as Appointment)}
        />
      )}

      {/* ── Detail Panel ───────────────────────────────────── */}
      <DetailPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelected(null);
        }}
        title={
          editing
            ? "Edit Appointment"
            : String(selected?.customer_name ?? "Appointment Details")
        }
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />

            <DetailSection title="Appointment Info">
              <DetailRow
                label="Date/Time"
                value={formatDateTime(
                  selected.appointment_date_time as string
                )}
              />
              <DetailRow
                label="Type"
                value={String(selected.appointment_type ?? "—")}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge status={selected.status as string} />}
              />
            </DetailSection>

            <DetailSection title="Customer">
              <DetailRow
                label="Name"
                value={String(selected.customer_name ?? "—")}
                href={`/customers`}
              />
              <DetailRow
                label="Phone"
                value={String(selected.phone ?? "—")}
              />
              <DetailRow
                label="Email"
                value={String(selected.email ?? "—")}
              />
            </DetailSection>

            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              {selected.status !== "Completed" && (
                <Button
                  size="sm"
                  onClick={() => quickStatus("Completed")}
                  disabled={saving}
                >
                  Mark Completed
                </Button>
              )}
              {selected.status !== "No-Show" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => quickStatus("No-Show")}
                  disabled={saving}
                >
                  Mark No-Show
                </Button>
              )}
              {selected.status !== "Cancelled" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => quickStatus("Cancelled")}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Customer Name">
              <input
                name="customer_name"
                defaultValue={String(selected.customer_name ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Phone">
              <input
                name="phone"
                defaultValue={String(selected.phone ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Email">
              <input
                name="email"
                defaultValue={String(selected.email ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Type">
              <select
                name="appointment_type"
                defaultValue={String(selected.appointment_type ?? "")}
                className={selectClass}
              >
                <option value="">Select type...</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Date/Time">
              <input
                name="appointment_date_time"
                type="datetime-local"
                defaultValue={
                  selected.appointment_date_time
                    ? String(selected.appointment_date_time).slice(0, 16)
                    : ""
                }
                className={inputClass}
              />
            </FormField>
            <FormField label="Status">
              <select
                name="status"
                defaultValue={String(selected.status ?? "")}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </DetailPanel>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/interfaces/appointments/page.tsx
git commit -m "feat: add Appointment Management interface with dashboard, calendar, and table views"
```

---

## Task 10: Build Contract Management Interface

**Files:**
- Create: `src/app/(admin)/interfaces/contracts/page.tsx`

- [ ] **Step 1: Create the contracts interface page**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Columns3, BarChart3, Table2 } from "lucide-react";
import { getContractStats } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader,
  StatCard,
  DataTable,
  FilterBar,
  ErrorBanner,
  StatusBadge,
  Button,
  FormField,
  inputClass,
  selectClass,
  Column,
} from "@/components/ui";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { LineChartCard, PieChartCard } from "@/components/charts";
import { KanbanBoard, KanbanItem } from "@/components/KanbanBoard";

type Contract = Record<string, unknown>;

const STATUS_OPTIONS = ["Draft", "Signed", "Active", "Completed", "Terminated"];

const KANBAN_COLUMNS = STATUS_OPTIONS.map((s) => ({ key: s, label: s }));

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 size={16} /> },
];

export default function ContractsInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getContractStats>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Contract | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getContractStats()
      .then(setStats)
      .catch(() => setError("Failed to load contracts."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch =
        !search ||
        [r.customer_name, r.vehicle_name, r.contract_type].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        );
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const kanbanItems: KanbanItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.all
      .filter((c) => c.id && c.status)
      .map((c) => ({
        id: String(c.id),
        status: String(c.status),
        ...c,
      }));
  }, [stats]);

  const columns: Column<Contract>[] = [
    {
      key: "customer_name",
      label: "Customer",
      render: (r) => (
        <span className="font-medium">{String(r.customer_name ?? "—")}</span>
      ),
    },
    { key: "vehicle_name", label: "Vehicle" },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status as string} />,
    },
    {
      key: "start_date",
      label: "Start",
      render: (r) => formatDate(r.start_date as string),
    },
    {
      key: "end_date",
      label: "End",
      render: (r) => formatDate(r.end_date as string),
    },
    {
      key: "total_contract_amount",
      label: "Total",
      render: (r) => formatCurrency(Number(r.total_contract_amount) || null),
    },
  ];

  function openDetail(item: Contract) {
    setSelected(item);
    setPanelOpen(true);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      record[k] = v || null;
    });
    // Type conversions
    if (record.base_price) record.base_price = Number(record.base_price);
    if (record.taxes_and_fees)
      record.taxes_and_fees = Number(record.taxes_and_fees);
    if (record.insurance_fee)
      record.insurance_fee = Number(record.insurance_fee);
    if (record.total_contract_amount)
      record.total_contract_amount = Number(record.total_contract_amount);
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("contracts", record);
    if (!result.success) {
      setSaving(false);
      setError(result.error);
      return;
    }
    setSaving(false);
    setPanelOpen(false);
    setSelected(null);
    load();
  }

  async function handleStatusChange(
    itemId: string,
    newStatus: string
  ): Promise<boolean> {
    const result = await adminUpsert("contracts", {
      id: itemId,
      status: newStatus,
    });
    if (result.success) {
      load();
      return true;
    }
    setError(result.error);
    return false;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Contract Management"
        description="Dashboard, kanban, and table views for all contracts"
      />

      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {/* ── Dashboard View ─────────────────────────────────── */}
      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Active" value={stats.active} />
            <StatCard
              label="Expiring This Week"
              value={stats.expiringThisWeek}
            />
            <StatCard label="Draft" value={stats.draft} />
            <StatCard
              label="Terminated This Month"
              value={stats.terminatedThisMonth}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <LineChartCard
              title="Contracts Signed (6 Months)"
              data={stats.signedOverTime}
              color="#10b981"
            />
            <PieChartCard
              title="Status Distribution"
              data={stats.statusDistribution}
            />
          </div>
        </div>
      )}

      {/* ── Table View ─────────────────────────────────────── */}
      {activeView === "table" && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search contracts..."
          >
            <select
              className={selectClass + " sm:w-48"}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterBar>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={openDetail}
          />
        </>
      )}

      {/* ── Kanban View ────────────────────────────────────── */}
      {activeView === "kanban" && (
        <KanbanBoard
          columns={KANBAN_COLUMNS}
          items={kanbanItems}
          onStatusChange={handleStatusChange}
          onCardClick={(item) => openDetail(item as Contract)}
          renderCard={(item) => (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {String(item.customer_name ?? "—")}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                {String(item.vehicle_name ?? "—")}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                {formatDate(item.start_date as string)} –{" "}
                {formatDate(item.end_date as string)}
              </p>
            </div>
          )}
        />
      )}

      {/* ── Detail Panel ───────────────────────────────────── */}
      <DetailPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelected(null);
        }}
        title={
          editing
            ? "Edit Contract"
            : String(selected?.customer_name ?? "Contract Details")
        }
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />

            <DetailSection title="Contract Info">
              <DetailRow
                label="Type"
                value={String(selected.contract_type ?? "—")}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge status={selected.status as string} />}
              />
              <DetailRow
                label="Start"
                value={formatDate(selected.start_date as string)}
              />
              <DetailRow
                label="End"
                value={formatDate(selected.end_date as string)}
              />
              <DetailRow
                label="Total"
                value={formatCurrency(
                  Number(selected.total_contract_amount) || null
                )}
              />
            </DetailSection>

            <DetailSection title="Customer">
              <DetailRow
                label="Name"
                value={String(selected.customer_name ?? "—")}
                href="/customers"
              />
              <DetailRow
                label="Phone"
                value={String(selected.phone ?? "—")}
              />
            </DetailSection>

            <DetailSection title="Vehicle">
              <DetailRow
                label="Vehicle"
                value={String(selected.vehicle_name ?? "—")}
                href="/interfaces/vehicles"
              />
              <DetailRow
                label="Plate"
                value={String(selected.license_plate ?? "—")}
              />
            </DetailSection>

            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Customer Name">
              <input
                name="customer_name"
                defaultValue={String(selected.customer_name ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Vehicle Name">
              <input
                name="vehicle_name"
                defaultValue={String(selected.vehicle_name ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Contract Type">
              <input
                name="contract_type"
                defaultValue={String(selected.contract_type ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Status">
              <select
                name="status"
                defaultValue={String(selected.status ?? "")}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date">
                <input
                  name="start_date"
                  type="date"
                  defaultValue={String(selected.start_date ?? "")}
                  className={inputClass}
                />
              </FormField>
              <FormField label="End Date">
                <input
                  name="end_date"
                  type="date"
                  defaultValue={String(selected.end_date ?? "")}
                  className={inputClass}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Base Price">
                <input
                  name="base_price"
                  type="number"
                  step="0.01"
                  defaultValue={String(selected.base_price ?? "")}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Total Amount">
                <input
                  name="total_contract_amount"
                  type="number"
                  step="0.01"
                  defaultValue={String(selected.total_contract_amount ?? "")}
                  className={inputClass}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </DetailPanel>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/interfaces/contracts/page.tsx
git commit -m "feat: add Contract Management interface with dashboard, kanban, and table views"
```

---

## Task 11: Build Vehicle Management Interface

**Files:**
- Create: `src/app/(admin)/interfaces/vehicles/page.tsx`

- [ ] **Step 1: Create the vehicles interface page**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Columns3, BarChart3, Table2 } from "lucide-react";
import { getVehicleStats, getMaintenance } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader,
  StatCard,
  DataTable,
  FilterBar,
  ErrorBanner,
  StatusBadge,
  Button,
  FormField,
  inputClass,
  selectClass,
  Column,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import { BarChartCard, PieChartCard } from "@/components/charts";
import { KanbanBoard, KanbanItem } from "@/components/KanbanBoard";

type Vehicle = Record<string, unknown>;

const STATUS_OPTIONS = [
  "Available",
  "Rented",
  "Under Maintenance",
  "Needs Repair",
  "Retired",
  "Coming Soon",
];

const KANBAN_COLUMNS = [
  { key: "Available", label: "Available" },
  { key: "Rented", label: "Rented" },
  { key: "Under Maintenance", label: "Under Maintenance" },
  { key: "Needs Repair", label: "Needs Repair" },
  { key: "Retired", label: "Retired" },
];

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 size={16} /> },
];

export default function VehiclesInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getVehicleStats>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recentMaintenance, setRecentMaintenance] = useState<
    Record<string, unknown>[]
  >([]);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getVehicleStats(), getMaintenance()])
      .then(([vStats, maint]) => {
        setStats(vStats);
        setRecentMaintenance(maint as Record<string, unknown>[]);
      })
      .catch(() => setError("Failed to load vehicles."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch =
        !search ||
        [
          r.vehicle_name,
          r.vehicle_make,
          r.vehicle_model,
          r.vin,
          r.license_plate,
        ].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        );
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const kanbanItems: KanbanItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.all
      .filter((v) => v.id && v.status)
      .map((v) => ({
        id: String(v.id),
        status: String(v.status),
        ...v,
      }));
  }, [stats]);

  // Get recent maintenance for the selected vehicle
  const vehicleMaintenance = useMemo(() => {
    if (!selected) return [];
    const name = String(selected.vehicle_name ?? "");
    return recentMaintenance
      .filter(
        (m) =>
          String(m.vehicle_name ?? "").toLowerCase() === name.toLowerCase()
      )
      .slice(0, 3);
  }, [selected, recentMaintenance]);

  const columns: Column<Vehicle>[] = [
    {
      key: "vehicle_name",
      label: "Vehicle",
      render: (r) => (
        <span className="font-medium">{String(r.vehicle_name ?? "—")}</span>
      ),
    },
    { key: "license_plate", label: "Plate" },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status as string} />,
    },
    {
      key: "weekly_rate",
      label: "Weekly Rate",
      render: (r) => formatCurrency(Number(r.weekly_rate) || null),
    },
    { key: "color", label: "Color" },
    {
      key: "odometer",
      label: "Odometer",
      render: (r) =>
        r.odometer ? Number(r.odometer).toLocaleString() : "—",
    },
  ];

  function openDetail(item: Vehicle) {
    setSelected(item);
    setPanelOpen(true);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      record[k] = v || null;
    });
    if (record.year) record.year = Number(record.year);
    if (record.weekly_rate) record.weekly_rate = Number(record.weekly_rate);
    if (record.odometer) record.odometer = Number(record.odometer);
    if (record.lowest_possible_price)
      record.lowest_possible_price = Number(record.lowest_possible_price);
    if (record.partner_percentage)
      record.partner_percentage = Number(record.partner_percentage);
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("fleet", record);
    if (!result.success) {
      setSaving(false);
      setError(result.error);
      return;
    }
    setSaving(false);
    setPanelOpen(false);
    setSelected(null);
    load();
  }

  async function handleStatusChange(
    itemId: string,
    newStatus: string
  ): Promise<boolean> {
    const result = await adminUpsert("fleet", {
      id: itemId,
      status: newStatus,
    });
    if (result.success) {
      load();
      return true;
    }
    setError(result.error);
    return false;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Vehicle Management"
        description="Dashboard, kanban, and table views for the fleet"
      />

      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {/* ── Dashboard View ─────────────────────────────────── */}
      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Total Fleet" value={stats.total} />
            <StatCard label="Available" value={stats.available} />
            <StatCard label="Rented" value={stats.rented} />
            <StatCard label="Maintenance" value={stats.underMaintenance} />
            <StatCard label="Needs Repair" value={stats.needsRepair} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <PieChartCard
              title="Fleet Status Distribution"
              data={stats.statusDistribution}
            />
            <BarChartCard
              title="Revenue per Vehicle (Top 10)"
              data={stats.revenuePerVehicle}
              color="#10b981"
            />
          </div>
        </div>
      )}

      {/* ── Table View ─────────────────────────────────────── */}
      {activeView === "table" && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search vehicles..."
          >
            <select
              className={selectClass + " sm:w-48"}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterBar>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={openDetail}
          />
        </>
      )}

      {/* ── Kanban View ────────────────────────────────────── */}
      {activeView === "kanban" && (
        <KanbanBoard
          columns={KANBAN_COLUMNS}
          items={kanbanItems}
          onStatusChange={handleStatusChange}
          onCardClick={(item) => openDetail(item as Vehicle)}
          renderCard={(item) => (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {String(item.vehicle_name ?? "—")}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {String(item.license_plate ?? "")}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                {formatCurrency(Number(item.weekly_rate) || null)}/wk
              </p>
            </div>
          )}
        />
      )}

      {/* ── Detail Panel ───────────────────────────────────── */}
      <DetailPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelected(null);
        }}
        title={
          editing
            ? "Edit Vehicle"
            : String(selected?.vehicle_name ?? "Vehicle Details")
        }
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />

            <DetailSection title="Vehicle Info">
              <DetailRow
                label="Name"
                value={String(selected.vehicle_name ?? "—")}
              />
              <DetailRow
                label="Make/Model"
                value={`${selected.vehicle_make ?? ""} ${selected.vehicle_model ?? ""}`}
              />
              <DetailRow
                label="Year"
                value={String(selected.year ?? "—")}
              />
              <DetailRow label="VIN" value={String(selected.vin ?? "—")} />
              <DetailRow
                label="Plate"
                value={String(selected.license_plate ?? "—")}
              />
              <DetailRow
                label="Color"
                value={String(selected.color ?? "—")}
              />
              <DetailRow
                label="Odometer"
                value={
                  selected.odometer
                    ? Number(selected.odometer).toLocaleString()
                    : "—"
                }
              />
              <DetailRow
                label="Weekly Rate"
                value={formatCurrency(Number(selected.weekly_rate) || null)}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge status={selected.status as string} />}
              />
            </DetailSection>

            {vehicleMaintenance.length > 0 && (
              <DetailSection title="Recent Maintenance">
                {vehicleMaintenance.map((m, i) => (
                  <DetailRow
                    key={i}
                    label={formatDate(
                      (m.appointment_date_time as string) ?? ""
                    )}
                    value={String(m.service_type ?? m.notes ?? "—")}
                  />
                ))}
                <a
                  href="/maintenance"
                  className="mt-1 inline-block text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  View all maintenance →
                </a>
              </DetailSection>
            )}

            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Vehicle Name">
              <input
                name="vehicle_name"
                defaultValue={String(selected.vehicle_name ?? "")}
                className={inputClass}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Make">
                <input
                  name="vehicle_make"
                  defaultValue={String(selected.vehicle_make ?? "")}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Model">
                <input
                  name="vehicle_model"
                  defaultValue={String(selected.vehicle_model ?? "")}
                  className={inputClass}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Year">
                <input
                  name="year"
                  type="number"
                  defaultValue={String(selected.year ?? "")}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Color">
                <input
                  name="color"
                  defaultValue={String(selected.color ?? "")}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="VIN">
              <input
                name="vin"
                defaultValue={String(selected.vin ?? "")}
                className={inputClass}
              />
            </FormField>
            <FormField label="License Plate">
              <input
                name="license_plate"
                defaultValue={String(selected.license_plate ?? "")}
                className={inputClass}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Weekly Rate">
                <input
                  name="weekly_rate"
                  type="number"
                  step="0.01"
                  defaultValue={String(selected.weekly_rate ?? "")}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Odometer">
                <input
                  name="odometer"
                  type="number"
                  defaultValue={String(selected.odometer ?? "")}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="Status">
              <select
                name="status"
                defaultValue={String(selected.status ?? "")}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </DetailPanel>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/interfaces/vehicles/page.tsx
git commit -m "feat: add Vehicle Management interface with dashboard, kanban, and table views"
```

---

## Task 12: Build Payment Management Interface

**Files:**
- Create: `src/app/(admin)/interfaces/payments/page.tsx`

- [ ] **Step 1: Create the payments interface page**

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Columns3, BarChart3, Table2 } from "lucide-react";
import { getPaymentStats } from "@/lib/queries";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import {
  PageHeader,
  StatCard,
  DataTable,
  FilterBar,
  ErrorBanner,
  StatusBadge,
  Button,
  FormField,
  inputClass,
  selectClass,
  Column,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ViewSwitcher, useActiveView } from "@/components/ViewSwitcher";
import { DetailPanel, DetailSection, DetailRow } from "@/components/DetailPanel";
import {
  BarChartCard,
  PieChartCard,
  LineChartCard,
} from "@/components/charts";
import { KanbanBoard, KanbanItem } from "@/components/KanbanBoard";

type Payment = Record<string, unknown>;

const STATUS_OPTIONS = ["Paid", "Pending", "Overdue"];
const METHOD_OPTIONS = [
  "Credit Card",
  "Cash",
  "Cashapp",
  "Stripe",
  "Zelle",
];

const KANBAN_COLUMNS = STATUS_OPTIONS.map((s) => ({ key: s, label: s }));

const VIEW_TABS = [
  { key: "dashboard", label: "Dashboard", icon: <BarChart3 size={16} /> },
  { key: "table", label: "Table", icon: <Table2 size={16} /> },
  { key: "kanban", label: "Kanban", icon: <Columns3 size={16} /> },
];

export default function PaymentsInterface() {
  const activeView = useActiveView("dashboard");

  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getPaymentStats>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getPaymentStats()
      .then(setStats)
      .catch(() => setError("Failed to load payments."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    return stats.all.filter((r) => {
      const matchSearch =
        !search ||
        [r.customer_name, r.payment_method, r.vehicle].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        );
      const matchStatus =
        !statusFilter || r.payment_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [stats, search, statusFilter]);

  const kanbanItems: KanbanItem[] = useMemo(() => {
    if (!stats) return [];
    return stats.all
      .filter((p) => p.id && p.payment_status)
      .map((p) => ({
        id: String(p.id),
        status: String(p.payment_status),
        ...p,
      }));
  }, [stats]);

  const columns: Column<Payment>[] = [
    {
      key: "customer_name",
      label: "Customer",
      render: (r) => (
        <span className="font-medium">{String(r.customer_name ?? "—")}</span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (r) => formatCurrency(Number(r.amount) || null),
    },
    {
      key: "payment_status",
      label: "Status",
      render: (r) => <StatusBadge status={r.payment_status as string} />,
    },
    { key: "payment_method", label: "Method" },
    {
      key: "last_payment_date",
      label: "Date",
      render: (r) => formatDate(r.last_payment_date as string),
    },
  ];

  function openDetail(item: Payment) {
    setSelected(item);
    setPanelOpen(true);
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      record[k] = v || null;
    });
    if (record.amount) record.amount = Number(record.amount);
    if (selected?.id) record.id = selected.id;
    const result = await adminUpsert("customer_payments", record);
    if (!result.success) {
      setSaving(false);
      setError(result.error);
      return;
    }
    setSaving(false);
    setPanelOpen(false);
    setSelected(null);
    load();
  }

  async function handleStatusChange(
    itemId: string,
    newStatus: string
  ): Promise<boolean> {
    const result = await adminUpsert("customer_payments", {
      id: itemId,
      payment_status: newStatus,
    });
    if (result.success) {
      load();
      return true;
    }
    setError(result.error);
    return false;
  }

  async function quickStatus(status: string) {
    if (!selected?.id) return;
    setSaving(true);
    const result = await adminUpsert("customer_payments", {
      id: selected.id,
      payment_status: status,
    });
    if (!result.success) {
      setError(result.error);
    } else {
      setSelected({ ...selected, payment_status: status });
      load();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payment Management"
        description="Dashboard, kanban, and table views for all payments"
      />

      <ViewSwitcher tabs={VIEW_TABS} defaultTab="dashboard" />

      {/* ── Dashboard View ─────────────────────────────────── */}
      {activeView === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Collected This Month"
              value={formatCurrency(stats.collectedThisMonth)}
            />
            <StatCard
              label="Pending"
              value={formatCurrency(stats.pending)}
            />
            <StatCard
              label="Overdue"
              value={formatCurrency(stats.overdue)}
            />
            <StatCard
              label="Avg Payment"
              value={formatCurrency(stats.avgPayment)}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <LineChartCard
              title="Revenue (6 Months)"
              data={stats.revenueOverTime}
              color="#10b981"
            />
            <BarChartCard
              title="Payments by Method"
              data={stats.byMethod}
              color="#8b5cf6"
            />
            <PieChartCard
              title="Status Distribution"
              data={stats.statusDistribution}
            />
          </div>
        </div>
      )}

      {/* ── Table View ─────────────────────────────────────── */}
      {activeView === "table" && (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search payments..."
          >
            <select
              className={selectClass + " sm:w-48"}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterBar>
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={openDetail}
          />
        </>
      )}

      {/* ── Kanban View ────────────────────────────────────── */}
      {activeView === "kanban" && (
        <KanbanBoard
          columns={KANBAN_COLUMNS}
          items={kanbanItems}
          onStatusChange={handleStatusChange}
          onCardClick={(item) => openDetail(item as Payment)}
          renderCard={(item) => (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                {String(item.customer_name ?? "—")}
              </p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(Number(item.amount) || null)}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                {String(item.payment_method ?? "")} ·{" "}
                {formatDate(item.last_payment_date as string)}
              </p>
            </div>
          )}
        />
      )}

      {/* ── Detail Panel ───────────────────────────────────── */}
      <DetailPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelected(null);
        }}
        title={
          editing
            ? "Edit Payment"
            : String(selected?.customer_name ?? "Payment Details")
        }
      >
        {selected && !editing && (
          <>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />

            <DetailSection title="Payment Info">
              <DetailRow
                label="Amount"
                value={formatCurrency(Number(selected.amount) || null)}
              />
              <DetailRow
                label="Status"
                value={
                  <StatusBadge
                    status={selected.payment_status as string}
                  />
                }
              />
              <DetailRow
                label="Method"
                value={String(selected.payment_method ?? "—")}
              />
              <DetailRow
                label="Date"
                value={formatDate(selected.last_payment_date as string)}
              />
            </DetailSection>

            <DetailSection title="Customer">
              <DetailRow
                label="Name"
                value={String(selected.customer_name ?? "—")}
                href="/customers"
              />
              <DetailRow
                label="Phone"
                value={String(selected.phone ?? "—")}
              />
            </DetailSection>

            <DetailSection title="Related">
              <DetailRow
                label="Vehicle"
                value={String(selected.vehicle ?? selected.vehicle_name ?? "—")}
                href="/interfaces/vehicles"
              />
              <DetailRow
                label="Contract"
                value={String(selected.contract ?? "—")}
                href="/interfaces/contracts"
              />
            </DetailSection>

            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              {selected.payment_status !== "Paid" && (
                <Button
                  size="sm"
                  onClick={() => quickStatus("Paid")}
                  disabled={saving}
                >
                  Mark Paid
                </Button>
              )}
              {selected.payment_status !== "Overdue" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => quickStatus("Overdue")}
                  disabled={saving}
                >
                  Mark Overdue
                </Button>
              )}
            </div>
          </>
        )}

        {selected && editing && (
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <FormField label="Customer Name">
              <input
                name="customer_name"
                defaultValue={String(selected.customer_name ?? "")}
                className={inputClass}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Amount">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={String(selected.amount ?? "")}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Payment Date">
                <input
                  name="last_payment_date"
                  type="date"
                  defaultValue={String(selected.last_payment_date ?? "")}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="Payment Method">
              <select
                name="payment_method"
                defaultValue={String(selected.payment_method ?? "")}
                className={selectClass}
              >
                <option value="">Select method...</option>
                {METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status">
              <select
                name="payment_status"
                defaultValue={String(selected.payment_status ?? "")}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </DetailPanel>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/interfaces/payments/page.tsx
git commit -m "feat: add Payment Management interface with dashboard, kanban, and table views"
```

---

## Task 13: Final Build Verification and Integration Commit

**Files:**
- All files from Tasks 1–12

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors (warnings acceptable).

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Manually verify:
1. Sidebar shows "Interfaces" group with 4 links
2. `/interfaces/appointments` — Dashboard loads with stat cards + charts. Table tab shows data. Calendar tab renders monthly/weekly grid.
3. `/interfaces/contracts` — Dashboard + Table + Kanban all render. Drag a card to change status.
4. `/interfaces/vehicles` — Dashboard + Table + Kanban all render. Detail panel shows maintenance records.
5. `/interfaces/payments` — Dashboard with 3 charts. Kanban with drag-and-drop. "Mark Paid" quick action works.

- [ ] **Step 4: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix: address issues found during interface smoke testing"
```

(Skip this step if no fixes needed.)
