import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { fetchCollectionsSummary } from "@/lib/dealer/analytics";
import { moneyUSD } from "@/lib/utils";
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

export default async function DealerCollectionsPage() {
  const { rows, totalOutstanding, overdueCount } = await fetchCollectionsSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Balances on sold/funded deals — BHPH and partial-pay tracking."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-semibold">{moneyUSD(totalOutstanding)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Accounts</p>
          <p className="text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Overdue</p>
          <p className="text-2xl font-semibold text-destructive">{overdueCount}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Next due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No open balances — log payments on funded deals.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.dealId}>
                <TableCell>
                  <Link href={`/internal/dealer/deals/${r.dealId}`} className="text-primary hover:underline">
                    {r.refCode}
                  </Link>
                </TableCell>
                <TableCell>{r.buyer}</TableCell>
                <TableCell>{moneyUSD(r.balance)}</TableCell>
                <TableCell>
                  {r.overdue ? (
                    <Badge variant="destructive">Overdue {r.nextDue}</Badge>
                  ) : (
                    (r.nextDue ?? "—")
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
