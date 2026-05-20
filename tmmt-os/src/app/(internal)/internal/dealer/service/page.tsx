import { PageHeader } from "@/components/page-header";
import { BridgeNotice } from "@/components/dealer/bridge-notice";
import { fetchServiceLaneRows } from "@/lib/dealer/analytics";
import { isDealerDataBridgeReady } from "@/lib/dealer/command-center";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DealerServicePage() {
  const ready = isDealerDataBridgeReady();
  const rows = ready ? await fetchServiceLaneRows() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service lane"
        description="Open ROs and maintenance from Command Center — recon and shop work."
      />
      {!ready && <BridgeNotice />}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scheduled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No maintenance rows — add in rentals admin maintenance or Command Center.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.vehicle ?? "—"}</TableCell>
                <TableCell>{r.serviceType ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r.status ?? "—"}</Badge>
                </TableCell>
                <TableCell>{r.scheduledAt ? formatDate(r.scheduledAt) : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
