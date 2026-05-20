import { PageHeader } from "@/components/page-header";
import { BridgeNotice } from "@/components/dealer/bridge-notice";
import { fetchDealerLeads, isDealerDataBridgeReady } from "@/lib/dealer/command-center";
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

export default async function DealerLeadsPage() {
  const ready = isDealerDataBridgeReady();
  const leads = ready ? await fetchDealerLeads() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Buyer pipeline from Command Center — convert to a deal from Deal desk."
      />
      {!ready && <BridgeNotice />}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Opportunity</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No leads yet.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <p className="font-medium">{l.contact_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{l.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{l.status ?? "—"}</Badge>
                </TableCell>
                <TableCell>{l.opportunity_name ?? "—"}</TableCell>
                <TableCell>{l.phone ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
