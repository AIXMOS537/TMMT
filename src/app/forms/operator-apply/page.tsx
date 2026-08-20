import ProgramIntakeForm from "@/components/forms/ProgramIntakeForm";

export default async function OperatorApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string }>;
}) {
  const sp = await searchParams;
  return (
    <ProgramIntakeForm
      formSlug="operator-apply"
      title="Operator seat · $297"
      kid="One hallway. One city to run. Never the engine keys."
      cost="$297 / month"
      time="1 day after hire tap"
      lane={sp.lane || "operator"}
    />
  );
}
