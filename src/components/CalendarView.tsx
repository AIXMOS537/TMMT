"use client";

import { useState, useMemo, ReactNode } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, getHours,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function CalendarView({
  events, onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  renderEventTooltip?: (event: CalendarEvent) => ReactNode;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>("month");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(mode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))}
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
            onClick={() => setCurrentDate(mode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))}
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

      {mode === "month" ? (
        <MonthGrid currentDate={currentDate} events={events} onEventClick={onEventClick} />
      ) : (
        <WeekGrid currentDate={currentDate} events={events} onEventClick={onEventClick} />
      )}
    </div>
  );
}

function MonthGrid({ currentDate, events, onEventClick }: {
  currentDate: Date; events: CalendarEvent[]; onEventClick?: (event: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-slate-400">{d}</div>
        ))}
      </div>
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
              <span className={cn(
                "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                isToday(day) ? "bg-blue-600 text-white font-bold" : "text-gray-700 dark:text-slate-300"
              )}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 truncate"
                  >
                    <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", STATUS_DOT_COLORS[ev.status ?? ""] ?? "bg-blue-400")} />
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block text-[10px] text-gray-400 dark:text-slate-500 px-1">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

function WeekGrid({ currentDate, events, onEventClick }: {
  currentDate: Date; events: CalendarEvent[]; onEventClick?: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="px-2 py-2 text-center">
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">{format(day, "EEE")}</div>
            <div className={cn(
              "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm",
              isToday(day) ? "bg-blue-600 text-white font-bold" : "text-gray-900 dark:text-slate-100"
            )}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 dark:border-slate-700/50">
            <div className="px-2 py-3 text-right text-xs text-gray-400 dark:text-slate-500">
              {hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            {days.map((day) => {
              const hourEvents = events.filter((e) => isSameDay(e.date, day) && getHours(e.date) === hour);
              return (
                <div key={day.toISOString()} className="border-l border-gray-100 dark:border-slate-700/50 p-0.5 min-h-[48px]">
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
