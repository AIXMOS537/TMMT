import { PageHeader } from "@/components/page-header";
import { fetchDealPayments } from "@/lib/dealer/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DealerPaymentsPage() {
  const payments = await fetchDealPayments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Cash-in log across all deals — collections-lite foundation."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Deal</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No payments yet — log from a deal detail page.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Link
                    href={`/internal/dealer/deals/${p.deal_id}`}
                    className="text-primary hover:underline"
                  >
                    {p.deals?.ref_code ?? p.deal_id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>{p.deals?.vehicle_label ?? "—"}</TableCell>
                <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                <TableCell>{p.method}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
