import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrgCheckoutSession } from "@/lib/stripe/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; canceled?: string };
}) {
  const me = await requireRole(["admin", "internal_team"]);
  const supabase = createSupabaseServerClient();

  let org: {
    name: string;
    plan_tier: string | null;
    billing_status: string | null;
  } | null = null;

  if (me.organization_id) {
    const { data } = await supabase
      .from("organizations")
      .select("name, plan_tier, billing_status")
      .eq("id", me.organization_id)
      .maybeSingle();
    org = data;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Stripe subscription for your organization (LotOS / TMMT OS)."
      />

      {searchParams.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Checkout completed — webhook will activate your plan shortly.
        </p>
      )}
      {searchParams.canceled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout canceled.
        </p>
      )}

      <div className="surface-card space-y-4 p-6">
        <p className="text-sm text-muted-foreground">Organization</p>
        <p className="text-lg font-semibold">{org?.name ?? "Not linked"}</p>
        <p className="flex items-center gap-2 text-sm">
          Status{" "}
          <Badge variant="outline">{org?.billing_status ?? "trialing"}</Badge>
          Plan <Badge variant="outline">{org?.plan_tier ?? "starter"}</Badge>
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <form action={createOrgCheckoutSession.bind(null, "starter")}>
            <Button type="submit" variant="outline">
              Subscribe Starter ($299/mo)
            </Button>
          </form>
          <form action={createOrgCheckoutSession.bind(null, "growth")}>
            <Button type="submit" variant="outline">
              Subscribe Growth ($499/mo)
            </Button>
          </form>
          <form action={createOrgCheckoutSession.bind(null, "pro")}>
            <Button type="submit">Subscribe Pro ($799/mo)</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
