import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PartyForm } from "@/components/dealer/party-form";
import { fetchDealsForOrg } from "@/lib/dealer/queries";
import { Button } from "@/components/ui/button";
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

export default async function DealerDealsPage() {
  const deals = await fetchDealsForOrg();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deal desk"
        description="Link buyer + vehicle + amounts — log payments on each deal."
        action={
          <Link href="/internal/dealer/deals/new">
            <Button>New deal</Button>
          </Link>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick add buyer
        </h2>
        <PartyForm compact />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sale</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No deals — create one to start the pilot workflow.
              </TableCell>
            </TableRow>
          ) : (
            deals.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link
                    href={`/internal/dealer/deals/${d.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {d.ref_code}
                  </Link>
                </TableCell>
                <TableCell>{d.parties?.full_name ?? "—"}</TableCell>
                <TableCell>{d.vehicle_label ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{d.status}</Badge>
                </TableCell>
                <TableCell>{d.sale_price != null ? `$${d.sale_price}` : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
