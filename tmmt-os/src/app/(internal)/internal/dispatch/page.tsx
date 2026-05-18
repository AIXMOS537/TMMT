import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const supabase = createSupabaseServerClient();
  const { data: loads } = await supabase
    .from("dispatch_loads")
    .select(
      "id, pickup, dropoff, window_start, window_end, status, partner_courier, created_at, cases(id, ref_code, customer_name, work_type, routing_status)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch loads"
        description="Loads created when routing detects dispatch work types (GHL or intake)."
      />
      <div className="rounded-md border">
        <Table>
          <Thead>
            <Tr>
              <Th>Case</Th>
              <Th>Route</Th>
              <Th>Status</Th>
              <Th>Courier</Th>
              <Th>Created</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(loads ?? []).length === 0 ? (
              <Tr>
                <Td colSpan={5} className="text-muted-foreground">
                  No dispatch loads yet. They appear when a case is routed with a dispatch work
                  type.
                </Td>
              </Tr>
            ) : (
              loads?.map((row) => {
                const c = row.cases as {
                  id?: string;
                  ref_code?: string;
                  customer_name?: string;
                  work_type?: string;
                } | null;
                return (
                  <Tr key={row.id}>
                    <Td>
                      {c?.id ? (
                        <Link
                          href={`/internal/cases/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.ref_code ?? c.id.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <div className="text-xs text-muted-foreground">{c?.customer_name}</div>
                      {c?.work_type ? (
                        <Badge variant="outline" className="mt-1">
                          {c.work_type}
                        </Badge>
                      ) : null}
                    </Td>
                    <Td className="text-sm">
                      {row.pickup ?? "—"} → {row.dropoff ?? "—"}
                    </Td>
                    <Td>
                      <Badge variant="secondary">{row.status}</Badge>
                    </Td>
                    <Td>{row.partner_courier ?? "—"}</Td>
                    <Td className="text-xs text-muted-foreground">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
