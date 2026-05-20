import CommandCenterShell from "@/components/CommandCenterShell";

export default function TeamsPage() {
  return (
    <CommandCenterShell>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
        Team workspaces ship in Phase 1. Notes, links, and message logs will live here.
      </p>
    </CommandCenterShell>
  );
}
