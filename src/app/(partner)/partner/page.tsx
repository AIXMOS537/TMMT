import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser } from "@/lib/auth-roles";
import { Card, StatCard, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Car, ClipboardList, Gauge, Wrench } from "lucide-react";

export type PartnerFleetRow = {
  fleet_id: string;
  vehicle_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  year: number | null;
  vehicle_status: string | null;
  color: string | null;
  partner_percentage: number | null;
  partner_portal_notes: string | null;
  last_updated_at: string | null;
};

export default async function PartnerPortalPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (getTierForUser(user) !== "partner") redirect("/");

  const { data, error } = await supabase.rpc("get_partner_fleet");

  if (error) {
    console.error("[partner] get_partner_fleet:", error.message);
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-6 text-red-800 dark:text-red-200 text-sm">
        Unable to load your vehicles. Confirm the portal migration ran and your
        account is linked to at least one vehicle.
      </div>
    );
  }

  const rows = (data ?? []) as PartnerFleetRow[];

  const rented = rows.filter((r) => r.vehicle_status === "Rented").length;
  const available = rows.filter((r) => r.vehicle_status === "Available").length;
  const maintenance = rows.filter(
    (r) =>
      r.vehicle_status === "Under Maintenance" ||
      r.vehicle_status === "Needs Repair"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
          Partner portal
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Your vehicles
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          High-level fleet status for investors and partners. Sensitive
          operations data is not shown here.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Assigned vehicles"
          value={rows.length}
          icon={<Car size={20} />}
          trend={`${available} available · ${rented} rented`}
        />
        <StatCard
          label="In rental program"
          value={rented}
          icon={<ClipboardList size={20} />}
          trend="Coarse lifecycle status only"
        />
        <StatCard
          label="Maintenance"
          value={maintenance}
          icon={<Wrench size={20} />}
          trend="Shop / upkeep states"
        />
        <StatCard
          label="Snapshot"
          value="Live"
          icon={<Gauge size={20} />}
          trend="Shows last record update time"
        />
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-gray-600 dark:text-slate-400 text-sm">
          No vehicles assigned yet. Ask TMMT ops to attach your account to fleet
          records.
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <Card key={r.fleet_id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {r.vehicle_name?.trim() ||
                      [r.vehicle_make, r.vehicle_model, r.year]
                        .filter(Boolean)
                        .join(" ") ||
                      "Vehicle"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {[r.vehicle_make, r.vehicle_model, r.year]
                      .filter(Boolean)
                      .join(" ")}
                    {r.color ? ` · ${r.color}` : ""}
                  </p>
                  {r.partner_percentage != null && (
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                      Partner share: {Number(r.partner_percentage)}%
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1">
                  {r.vehicle_status ? (
                    <StatusBadge status={r.vehicle_status} />
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                  {r.last_updated_at && (
                    <span className="text-xs text-gray-500 dark:text-slate-500">
                      Updated {formatDateTime(r.last_updated_at)}
                    </span>
                  )}
                </div>
              </div>
              {r.partner_portal_notes?.trim() && (
                <p className="mt-4 text-sm text-gray-700 dark:text-slate-300 border-t border-gray-100 dark:border-slate-800 pt-4">
                  {r.partner_portal_notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
