import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { GhlLiveSync } from "@/components/ghl-sync/ghl-live-sync";
import { FieldsPreview } from "@/components/ghl-sync/fields-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { fetchGhlSyncDashboard } from "@/lib/ghl/queries";
import { formatDate, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tab = "contacts" | "forms" | "appointments" | "events";

const TABS: { id: Tab; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "forms", label: "Form submissions" },
  { id: "appointments", label: "Appointments" },
  { id: "events", label: "Webhook log" },
];

export default async function GhlSyncPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = (TABS.some((t) => t.id === searchParams.tab)
    ? searchParams.tab
    : "contacts") as Tab;

  const { contacts, forms, appointments, events, counts, error } =
    await fetchGhlSyncDashboard();

  return (
    <div className="space-y-6">
      <GhlLiveSync />
      <PageHeader
        title="GHL live sync"
        description="Contacts, forms, and appointments from GoHighLevel webhooks. This page auto-refreshes when new data hits Supabase."
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          Live
        </span>
        <span>
          Webhooks:{" "}
          <code className="text-[10px]">/api/webhooks/ghl/*</code>
        </span>
        <Link href="/internal/sync" className="text-primary underline">
          CRM sync queue
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          Could not load GHL data. Run migration{" "}
          <code className="text-xs">0012_ghl_live_sync.sql</code> in Supabase.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contacts" value={String(counts.contacts)} />
        <StatCard label="Form submissions" value={String(counts.forms)} />
        <StatCard label="Appointments" value={String(counts.appointments)} />
        <StatCard label="GHL events (24h)" value={String(counts.events24h)} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {TABS.find((t) => t.id === tab)?.label ?? "Contacts"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={`/internal/ghl-sync?tab=${t.id}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  tab === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {tab === "contacts" && (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>GHL contact ID</Th>
                  <Th>Synced</Th>
                </Tr>
              </Thead>
              <Tbody>
                {contacts.length === 0 && <EmptyRow cols={5} />}
                {contacts.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium">{r.full_name ?? "—"}</Td>
                    <Td className="text-sm">{r.email ?? "—"}</Td>
                    <Td className="text-sm">{r.phone ?? "—"}</Td>
                    <Td className="font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">
                      {r.ghl_contact_id}
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {formatDate(r.synced_at)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {tab === "forms" && (
            <Table>
              <Thead>
                <Tr>
                  <Th>Form</Th>
                  <Th>Fields</Th>
                  <Th>Contact</Th>
                  <Th>Case</Th>
                  <Th>Submitted</Th>
                </Tr>
              </Thead>
              <Tbody>
                {forms.length === 0 && <EmptyRow cols={5} />}
                {forms.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="font-medium text-sm">
                        {r.form_name ?? r.form_id ?? "Form"}
                      </div>
                      {r.ghl_submission_id && (
                        <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {r.ghl_submission_id}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <FieldsPreview fields={r.fields ?? {}} />
                    </Td>
                    <Td className="font-mono text-[10px] text-muted-foreground max-w-[100px] truncate">
                      {r.ghl_contact_id ?? "—"}
                    </Td>
                    <Td>
                      {r.case_id ? (
                        <Link
                          href={`/internal/cases/${r.case_id}`}
                          className="text-sm text-primary underline"
                        >
                          View case
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {formatDate(r.created_at)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {tab === "appointments" && (
            <Table>
              <Thead>
                <Tr>
                  <Th>Title</Th>
                  <Th>Status</Th>
                  <Th>Starts</Th>
                  <Th>Contact</Th>
                  <Th>Appointment ID</Th>
                </Tr>
              </Thead>
              <Tbody>
                {appointments.length === 0 && <EmptyRow cols={5} />}
                {appointments.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium text-sm">{r.title ?? "—"}</Td>
                    <Td className="text-sm">{r.status ?? "—"}</Td>
                    <Td className="text-xs text-muted-foreground">
                      {r.starts_at ? formatDate(r.starts_at) : "—"}
                    </Td>
                    <Td className="font-mono text-[10px] text-muted-foreground max-w-[100px] truncate">
                      {r.ghl_contact_id ?? "—"}
                    </Td>
                    <Td className="font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">
                      {r.ghl_appointment_id}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {tab === "events" && (
            <Table>
              <Thead>
                <Tr>
                  <Th>Event</Th>
                  <Th>External ID</Th>
                  <Th>Processed</Th>
                  <Th>Error</Th>
                  <Th>Time</Th>
                </Tr>
              </Thead>
              <Tbody>
                {events.length === 0 && <EmptyRow cols={5} />}
                {events.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-sm font-medium">{r.event_type}</Td>
                    <Td className="font-mono text-[10px] text-muted-foreground max-w-[140px] truncate">
                      {r.external_id ?? "—"}
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          r.processed
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        )}
                      >
                        {r.processed ? "yes" : "pending"}
                      </span>
                    </Td>
                    <Td className="text-xs text-red-600 max-w-[160px] truncate">
                      {r.error ?? "—"}
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {formatDate(r.created_at)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <Tr>
      <Td colSpan={cols} className="text-muted-foreground text-sm py-8 text-center">
        No records yet. Point GHL workflows at{" "}
        <code className="text-xs">/api/webhooks/ghl/*</code> on TMMT OS.
      </Td>
    </Tr>
  );
}
