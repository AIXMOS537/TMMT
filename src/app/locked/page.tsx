export const metadata = { title: "Activation required" };

/**
 * Shown when the backend lock (BACKEND_LOCK_ENABLED) is on and the user's
 * installation isn't fully activated. Reveals nothing about the system — just
 * the activation gate.
 */
export default function LockedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-semibold text-white">Activation required</h1>
        <p className="text-neutral-400">
          This system is locked. Backend access unlocks after the full
          installation is complete — payment, setup, and comprehension sign-off —
          and your license is activated.
        </p>
        <p className="text-sm text-neutral-500">
          Contact your installation provider to complete activation.
        </p>
      </div>
    </main>
  );
}
