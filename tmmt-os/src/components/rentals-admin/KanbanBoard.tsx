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

    let targetStatus: string | null = null;

    if (columns.some((c) => c.key === over.id)) {
      targetStatus = over.id as string;
    } else {
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
