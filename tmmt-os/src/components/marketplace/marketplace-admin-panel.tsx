"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  deleteMarketplaceListingAction,
  upsertMarketplaceListingAction,
} from "@/lib/marketplace/actions";
import type { MarketplaceListing } from "@/lib/marketplace/types";
import { PARTNER_APPS } from "@/lib/verticals/partner-apps";

export function MarketplaceAdminPanel({ listings }: { listings: MarketplaceListing[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-8">
      <form
        className="surface-card space-y-4 p-5"
        action={(fd) => start(() => upsertMarketplaceListingAction(fd))}
      >
        <h2 className="text-lg font-medium">Add listing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="vertical_slug">Vertical</Label>
            <Select id="vertical_slug" name="vertical_slug" defaultValue="tmmt_rentals">
              {PARTNER_APPS.filter((a) => a.wave === 1).map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="listing_type">Type</Label>
            <Select id="listing_type" name="listing_type" defaultValue="deal">
              <option value="deal">Deal</option>
              <option value="vendor">Vendor</option>
              <option value="opportunity">Opportunity</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
        <div>
          <Label htmlFor="financial_summary">Financial summary</Label>
          <Input id="financial_summary" name="financial_summary" placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="external_url">External URL</Label>
          <Input id="external_url" name="external_url" type="url" placeholder="https://" />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" />
            Featured
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked />
            Active
          </label>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create listing"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">All listings ({listings.length})</h2>
        {!listings.length ? (
          <p className="text-sm text-muted-foreground">
            No listings yet. Run migration 0030 or add rows above.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {listings.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {row.title}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {row.listing_type} · {row.vertical_slug}
                      {!row.active ? " · inactive" : ""}
                      {row.featured ? " · featured" : ""}
                    </span>
                  </p>
                  {row.financial_summary && (
                    <p className="text-sm text-muted-foreground">{row.financial_summary}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(() => {
                      if (confirm("Delete this listing?")) {
                        deleteMarketplaceListingAction(row.id);
                      }
                    })
                  }
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
