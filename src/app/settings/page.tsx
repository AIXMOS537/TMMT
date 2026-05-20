import CommandCenterShell from "@/components/CommandCenterShell";

export default function SettingsPage() {
  return (
    <CommandCenterShell>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
        Venture and integration settings will be configured here in a later phase.
      </p>
    </CommandCenterShell>
  );
}
