import Link from "next/link";
import { fetchCommandCenterBridgeByEmail } from "@/lib/command-center-bridge/queries";
import { formatDate, moneyUSD } from "@/lib/utils";
import { rentalsInterfaceHref } from "@/lib/rentals-portal";

export async function JourneyCommandCenterBridge({ email }: { email: string }) {
  const bridge = await fetchCommandCenterBridgeByEmail(email);

  if (!bridge.configured) {
    return (
      <section className="surface-card p-4 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">Command Center (legacy)</h2>
        <p className="mt-1">
          Set <code className="text-xs">COMMAND_CENTER_SUPABASE_URL</code> and{" "}
          <code className="text-xs">COMMAND_CENTER_SUPABASE_SERVICE_KEY</code> to show rental
          contracts and background checks from the root app.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Command Center (read-only)</h2>
        <Link
          href={rentalsInterfaceHref("contracts")}
          className="text-sm text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open contracts workspace →
        </Link>
      </div>
      {bridge.contracts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Rental contracts</h3>
          <ul className="divide-y rounded-lg border text-sm">
            {bridge.contracts.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:justify-between">
                <span>
                  #{c.contract_id ?? "—"} · {c.active_customer ?? "—"}
                </span>
                <span className="text-muted-foreground">
                  {c.contract_status ?? "—"}
                  {c.total_contract_amount != null ? ` · ${moneyUSD(c.total_contract_amount)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bridge.backgroundChecks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Background checks</h3>
          <ul className="divide-y rounded-lg border text-sm">
            {bridge.backgroundChecks.map((b) => (
              <li key={b.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:justify-between">
                <span>{b.customer_name ?? b.email}</span>
                <span className="text-muted-foreground">
                  {b.background_check_status ?? "—"}
                  {b.created_at ? ` · ${formatDate(b.created_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bridge.contracts.length === 0 && bridge.backgroundChecks.length === 0 && (
        <p className="text-sm text-muted-foreground">No legacy contracts or background checks for this email.</p>
      )}
    </section>
  );
}
