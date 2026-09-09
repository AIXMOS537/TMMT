import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntakeBusinessConfig } from "@/lib/intake/businesses";
import type { RequestType } from "@/lib/workflow/statuses";
import { REQUEST_TYPE_LABELS } from "@/lib/intake/request-type-labels";
import { submitIntakeAction } from "@/app/intake/actions";

/**
 * Ported from TMMT OS.
 *
 * Two things dropped on the way in, both belonging to a later phase: the
 * FastTrackForm wrapper and the data-fast-track attributes on the name, email
 * and phone inputs. Fast Track lives only on the TMMT-OS-ARCHIVE
 * `dev-copy-cdev` branch and has no counterpart here yet; wiring the
 * attributes with nothing reading them would be dead markup. The form posts
 * and works without it.
 */
type Props = {
  business: IntakeBusinessConfig;
  error?: string;
  defaultRequestType?: string;
};

export function IntakeForm({ business, error, defaultRequestType }: Props) {
  const defaultType: RequestType =
    defaultRequestType && business.requestTypes.includes(defaultRequestType as RequestType)
      ? (defaultRequestType as RequestType)
      : business.requestTypes[0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-12">
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/intake" className="underline">
          ← All businesses
        </Link>
      </p>
      <Card className={cn("overflow-hidden bg-linear-to-br ring-1", business.accent)}>
        <CardHeader>
          <CardTitle className="text-xl">{business.title}</CardTitle>
          <CardDescription>{business.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <form action={submitIntakeAction} className="space-y-4">
            <input type="hidden" name="business_slug" value={business.slug} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer_name">Your name *</Label>
                <Input id="customer_name" name="customer_name" autoComplete="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_email">Email</Label>
                <Input id="customer_email" name="customer_email" type="email" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_phone">Phone</Label>
                <Input id="customer_phone" name="customer_phone" type="tel" autoComplete="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request_type">Request type *</Label>
                <Select id="request_type" name="request_type" defaultValue={defaultType} required>
                  {business.requestTypes.map((rt) => (
                    <option key={rt} value={rt}>
                      {REQUEST_TYPE_LABELS[rt]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Short subject *</Label>
              <Input
                id="subject"
                name="subject"
                required
                maxLength={200}
                placeholder={business.subjectPlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="details">Details</Label>
              <Textarea
                id="details"
                name="details"
                rows={6}
                placeholder={business.detailsPlaceholder}
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Submit request
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
