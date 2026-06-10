"use client";

import Link from "next/link";
import {
  Brain,
  Briefcase,
  Car,
  LayoutGrid,
  RotateCcw,
} from "lucide-react";
import { cn } from "../utils";
import {
  type CubeFace,
  facesForRole,
  getCubeUrls,
  learnPath,
  workPath,
} from "./config";
import { STATUS_LABELS, workflowProgress } from "../status-machine";
import type { ApplicationStatus } from "../types";

const FACE_META: Record<
  CubeFace,
  { label: string; icon: typeof Brain; description: string }
> = {
  learn: {
    label: "Learn",
    icon: Brain,
    description: "Education, readiness & coach",
  },
  work: {
    label: "Work",
    icon: Briefcase,
    description: "Reviews, approvals & queue",
  },
  fleet: {
    label: "Fleet",
    icon: Car,
    description: "Rentals & operations",
  },
  command: {
    label: "Command",
    icon: LayoutGrid,
    description: "Owner hub & dispatch",
  },
};

function faceHref(face: CubeFace, applicationId?: string): string {
  const urls = getCubeUrls();
  switch (face) {
    case "learn":
      return learnPath("/dashboard", applicationId);
    case "work":
      return workPath("/work/program", applicationId);
    case "fleet":
      return `${urls.fleet.replace(/\/$/, "")}/fleet`;
    case "command":
      return `${urls.command.replace(/\/$/, "")}/command`;
  }
}

export function CubeShell({
  activeFace,
  role,
  applicationId,
  status,
  userName,
  onReset,
  children,
}: {
  activeFace: CubeFace;
  role: string;
  applicationId?: string;
  status?: ApplicationStatus;
  userName?: string;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  const faces = facesForRole(role);
  const progress = status ? workflowProgress(status) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-blue-50/30">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-blue-700 text-sm font-bold text-white">
              AX
            </div>
            <div>
              <p className="font-semibold text-slate-900">AIXMOS × TMMT</p>
              <p className="text-xs text-slate-500">One cube · two faces · shared core</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {userName && <span>{userName}</span>}
            {status && (
              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-900">
                {STATUS_LABELS[status]}
              </span>
            )}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
              >
                <RotateCcw className="h-3 w-3" />
                Reset demo
              </button>
            )}
          </div>
        </div>

        <nav
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3"
          aria-label="Cube faces"
        >
          {faces.map((face) => {
            const meta = FACE_META[face];
            const Icon = meta.icon;
            const href = faceHref(face, applicationId);
            const isActive = face === activeFace;

            const className = cn(
              "flex min-w-[120px] flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
              isActive
                ? "border-teal-600 bg-teal-700 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
            );

            const inner = (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="font-medium leading-tight">{meta.label}</p>
                  <p
                    className={cn(
                      "text-[10px] leading-tight",
                      isActive ? "text-teal-100" : "text-slate-500"
                    )}
                  >
                    {meta.description}
                  </p>
                </div>
              </>
            );

            const isExternal = href.startsWith("http");

            if (isExternal) {
              return (
                <a key={face} href={href} className={className}>
                  {inner}
                </a>
              );
            }

            return (
              <Link key={face} href={href} className={className}>
                {inner}
              </Link>
            );
          })}
        </nav>

        {status && (
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
