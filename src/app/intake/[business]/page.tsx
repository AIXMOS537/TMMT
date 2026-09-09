import { notFound } from "next/navigation";
import { IntakeForm } from "@/components/intake-form";
import { getIntakeBusiness } from "@/lib/intake/businesses";

/**
 * Ported from TMMT OS, which is on Next 14 where `params` and `searchParams`
 * are plain objects. On Next 16 both are promises and must be awaited.
 */
export default async function BusinessIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ business: string }>;
  searchParams: Promise<{ error?: string; type?: string }>;
}) {
  const { business: slug } = await params;
  const { error, type } = await searchParams;

  const business = getIntakeBusiness(slug);
  if (!business) notFound();

  return <IntakeForm business={business} error={error} defaultRequestType={type} />;
}
