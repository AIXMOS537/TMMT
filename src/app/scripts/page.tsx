import CommandCenterShell from "@/components/CommandCenterShell";

export default function ScriptsPage() {
  return (
    <CommandCenterShell>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scripts library</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
        Searchable script index ships in Phase 2. Filesystem source of truth:{" "}
        <code className="text-xs">AIX_Command_Center/scripts-library/</code>
      </p>
    </CommandCenterShell>
  );
}
