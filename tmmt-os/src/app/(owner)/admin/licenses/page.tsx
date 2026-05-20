import { requireEntitlement } from "@/lib/auth-portals";
import { ORG_MODULES } from "@/lib/access/org-license";
import { PROVISION_SKUS } from "@/lib/access/provision";
import { LICENSE_TIERS } from "@/lib/access/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  assignProfileOrganization,
  createOrganization,
  provisionOrgFromSku,
  updateOrgLicense,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLicensesPage() {
  await requireEntitlement("admin_licenses", "/admin/dashboard");
  const supabase = createSupabaseServerClient();

  const [{ data: orgs }, { data: profiles }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        `
        id,
        name,
        kind,
        created_at,
        organization_licenses (
          license_tier,
          modules,
          max_ventures,
          provisioned_at
        )
      `
      )
      .order("name"),
    supabase
      .from("profiles")
      .select("id, email, full_name, organization_id")
      .order("email"),
  ]);

  const skuOptions = Object.entries(PROVISION_SKUS);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Organization licenses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lock-and-key provisioning: assign what each operator purchased (rentals app, full OS,
          add-ons). User packages are capped by the org license.
        </p>
      </header>

      <Card className="border-blue-200/60 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-base">Production rollout</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <span className="text-foreground font-medium">TMMT HQ</span> stays on{" "}
              <code className="text-xs">full_os</code> (your team). Do not remove it.
            </li>
            <li>
              For each <span className="text-foreground font-medium">customer you sell</span>: create
              their organization below with their real company name.
            </li>
            <li>
              Apply a SKU: <code className="text-xs">rentals_app</code> (car rentals only),{" "}
              <code className="text-xs">full_os</code> (~$50k platform), or an add-on SKU.
            </li>
            <li>
              Assign their staff and clients to that org via{" "}
              <span className="text-foreground">Assign user</span> below or on{" "}
              <a href="/admin/users" className="text-blue-600 dark:text-blue-400 underline">
                User management
              </a>
              .
            </li>
            <li>
              Verify: log in as a user on that org — lifecycle pages and ops nav should match what
              they purchased.
            </li>
          </ol>
          <p>
            Migrations <code className="text-xs">0019</code> and <code className="text-xs">0020</code>{" "}
            must be applied once per Supabase project. Production is already migrated; new
            environments: run those SQL files before first provision.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrganization} className="flex flex-wrap gap-3 items-end">
            <label className="text-xs space-y-1 flex-1 min-w-[200px]">
              Company name
              <input
                name="name"
                required
                placeholder="TMMT Rentals LLC"
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              />
            </label>
            <label className="text-xs space-y-1 w-32">
              Kind
              <select name="kind" defaultValue="tmmt" className="w-full border rounded-md h-9 px-2 text-sm bg-background">
                <option value="tmmt">tmmt</option>
                <option value="investor_group">investor_group</option>
                <option value="vendor_company">vendor_company</option>
              </select>
            </label>
            <Button type="submit" size="sm">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(orgs ?? []).map((org) => {
          const lic = Array.isArray(org.organization_licenses)
            ? org.organization_licenses[0]
            : org.organization_licenses;
          const members = (profiles ?? []).filter((p) => p.organization_id === org.id);

          return (
            <Card key={org.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {org.name}
                  <span className="text-muted-foreground font-normal text-sm">
                    {lic?.license_tier ?? "no license"} · {members.length} user
                    {members.length === 1 ? "" : "s"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!lic && (
                  <form action={provisionOrgFromSku} className="flex flex-wrap gap-2 items-end">
                    <input type="hidden" name="organization_id" value={org.id} />
                    <label className="text-xs space-y-1">
                      Quick provision (SKU)
                      <select name="sku" className="border rounded-md h-9 px-2 text-sm bg-background">
                        {skuOptions.map(([sku, m]) => (
                          <option key={sku} value={sku}>
                            {sku} — {m.license_tier}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" size="sm">
                      Apply SKU
                    </Button>
                  </form>
                )}

                <form action={updateOrgLicense} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <input type="hidden" name="organization_id" value={org.id} />
                  <label className="text-xs space-y-1">
                    License tier
                    <select
                      name="license_tier"
                      defaultValue={lic?.license_tier ?? "rentals_app"}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    >
                      {LICENSE_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    Max ventures
                    <input
                      name="max_ventures"
                      type="number"
                      min={1}
                      defaultValue={lic?.max_ventures ?? 1}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    />
                  </label>
                  <div className="text-xs space-y-2 md:col-span-2">
                    <span className="font-medium">Modules</span>
                    <div className="flex flex-wrap gap-3">
                      {ORG_MODULES.map((m) => (
                        <label key={m} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            name={`module_${m}`}
                            defaultChecked={lic?.modules?.includes(m) ?? m === "rentals_app"}
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" size="sm">
                      Save license
                    </Button>
                  </div>
                </form>

                {members.length > 0 && (
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    <p className="font-medium text-foreground mb-1">Members</p>
                    <ul className="space-y-1">
                      {members.map((p) => (
                        <li key={p.id}>
                          {p.full_name || p.email}{" "}
                          <span className="text-muted-foreground">({p.email})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign user to organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={assignProfileOrganization} className="flex flex-wrap gap-3 items-end">
            <label className="text-xs space-y-1 flex-1 min-w-[200px]">
              User
              <select
                name="profile_id"
                required
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              >
                <option value="">Select user…</option>
                {(profiles ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1 flex-1 min-w-[200px]">
              Organization
              <select
                name="organization_id"
                className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              >
                <option value="">— none —</option>
                {(orgs ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm">
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
