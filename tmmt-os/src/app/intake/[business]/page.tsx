import { notFound } from "next/navigation";
import { IntakeForm } from "@/components/intake-form";
import { getIntakeBusiness } from "@/lib/intake/businesses";

export default function BusinessIntakePage({
  params,
  searchParams,
}: {
  params: { business: string };
  searchParams: { error?: string; type?: string };
}) {
  const business = getIntakeBusiness(params.business);
  if (!business) notFound();

  return (
    <IntakeForm
      business={business}
      error={searchParams.error}
      defaultRequestType={searchParams.type}
    />
  );
}
