import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DealForm } from "@/components/dealer/deal-form";
import { PaymentLogForm } from "@/components/dealer/payment-log-form";
import { fetchDealerFleet, isDealerDataBridgeReady } from "@/lib/dealer/command-center";
import {
  fetchDealById,
  fetchDealPaymentsForDeal,
  fetchPartiesForOrg,
} from "@/lib/dealer/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const deal = await fetchDealById(params.id);
  if (!deal) notFound();

  const [parties, fleet, payments] = await Promise.all([
    fetchPartiesForOrg(),
    isDealerDataBridgeReady() ? fetchDealerFleet() : Promise.resolve([]),
    fetchDealPaymentsForDeal(params.id),
  ]);

  const vehicles = fleet.map((f) => ({
    id: f.id,
    label: f.vehicle_name ?? [f.year, f.vehicle_make, f.vehicle_model].filter(Boolean).join(" "),
    vin: f.vin_number,
  }));

  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={deal.ref_code}
        description={deal.vehicle_label ?? "Deal desk record"}
      />

      <DealForm deal={deal} parties={parties} vehicles={vehicles} />

      <section className="surface-card space-y-4 p-6">
        <h2 className="font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Logged: ${paid.toFixed(2)}
          {deal.sale_price != null && ` · Sale price $${deal.sale_price}`}
        </p>
        <PaymentLogForm dealId={deal.id} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No payments logged.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                  <TableCell>${Number(p.amount).toFixed(2)}</TableCell>
                  <TableCell>{p.method}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
