import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BridgeNotice() {
  return (
    <Card className="border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Command Center bridge required</CardTitle>
        <CardDescription>
          Set <code className="text-xs">COMMAND_CENTER_SUPABASE_URL</code> and{" "}
          <code className="text-xs">COMMAND_CENTER_SUPABASE_SERVICE_KEY</code> in TMMT OS so
          inventory and leads read from your fleet database. Apply migration{" "}
          <code className="text-xs">20260518120000_dealer_fleet_retail.sql</code> on Command
          Center Supabase, and <code className="text-xs">0016_dealer_core.sql</code> on TMMT OS.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Deals and payment logs live in TMMT OS; lot inventory and leads sync from Command Center.
      </CardContent>
    </Card>
  );
}
