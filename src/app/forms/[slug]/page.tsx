import { notFound } from "next/navigation";
import { BusinessLineIntakeForm } from "@/components/forms/BusinessLineIntakeForm";
import { getBusinessLineByIntakeSlug, listIntakeLines } from "@/lib/business-lines/registry";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listIntakeLines()
    .filter((line) => line.intake?.slug && line.intake.slug !== "rentals")
    .map((line) => ({ slug: line.intake!.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const line = getBusinessLineByIntakeSlug(slug);
  if (!line?.intake) return { title: "TMMT Intake" };
  return {
    title: `${line.intake.title} | TMMT`,
    description: line.intake.description,
  };
}

export default async function BusinessLineIntakePage({ params }: PageProps) {
  const { slug } = await params;
  const line = getBusinessLineByIntakeSlug(slug);
  if (!line?.intake) notFound();
  return <BusinessLineIntakeForm line={line} />;
}
