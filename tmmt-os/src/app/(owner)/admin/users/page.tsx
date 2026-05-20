import { requireEntitlement } from "@/lib/auth-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateUserAccess } from "./actions";
import {
  ADMIN_SCOPES,
  PORTAL_ROLES,
  TEAM_DEPARTMENTS,
  PACKAGE_SLUGS,
} from "@/lib/access/types";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireEntitlement("admin_users", "/admin/dashboard");
  const supabase = createSupabaseServerClient();

  const [{ data: profiles }, { data: packages }, { data: organizations }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        full_name,
        role,
        portal_role,
        admin_scope,
        team_department,
        organization_id,
        packages:package_id ( slug, name ),
        organizations:organization_id ( name )
      `
      )
      .order("email"),
    supabase.from("packages").select("slug, name").order("tier"),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">User management</h1>
        <p className="text-sm text-muted-foreground">
          Assign portal roles, packages (Starter / Growth / Elite), and team departments. Enable
          &quot;Sync ops role&quot; so team members can use /internal and edit cases in the database.
        </p>
      </header>

      <div className="space-y-4">
        {(profiles ?? []).map((p) => {
          const raw = p.packages as { slug: string; name: string } | { slug: string; name: string }[] | null;
          const pkg = Array.isArray(raw) ? raw[0] : raw;
          const orgRaw = p.organizations as { name: string } | { name: string }[] | null;
          const orgName = Array.isArray(orgRaw) ? orgRaw[0]?.name : orgRaw?.name;
          return (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {p.full_name || p.email}
                  <span className="text-muted-foreground font-normal text-sm ml-2">{p.email}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateUserAccess} className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
                  <input type="hidden" name="profile_id" value={p.id} />
                  <label className="text-xs space-y-1">
                    Portal role
                    <select
                      name="portal_role"
                      defaultValue={p.portal_role ?? "client"}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    >
                      {PORTAL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    Legacy ops role
                    <select
                      name="legacy_role"
                      defaultValue={p.role}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    >
                      <option value="customer">customer</option>
                      <option value="internal_team">internal_team</option>
                      <option value="vendor">vendor</option>
                      <option value="investor">investor</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    Organization
                    <select
                      name="organization_id"
                      defaultValue={p.organization_id ?? ""}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                      title={orgName ? `Current: ${orgName}` : "No org — no license cap"}
                    >
                      <option value="">— none —</option>
                      {(organizations ?? []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    Package
                    <select
                      name="package_slug"
                      defaultValue={pkg?.slug ?? ""}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    >
                      <option value="">— none —</option>
                      {PACKAGE_SLUGS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    Team dept
                    <select
                      name="team_department"
                      defaultValue={p.team_department ?? ""}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    >
                      <option value="">—</option>
                      {TEAM_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1">
                    Admin scope
                    <select
                      name="admin_scope"
                      defaultValue={p.admin_scope ?? ""}
                      className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                    >
                      <option value="">—</option>
                      {ADMIN_SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" name="sync_legacy_from_portal" defaultChecked />
                      Sync ops role
                    </label>
                    <Button type="submit" size="sm" className="w-full">
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {packages && packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Packages in database</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {packages.map((p) => (
              <p key={p.slug}>
                {p.name} ({p.slug})
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
