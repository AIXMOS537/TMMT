import { redirect } from "next/navigation";

export default async function LearnIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>;
}) {
  const params = await searchParams;
  const q = params.applicationId
    ? `?applicationId=${encodeURIComponent(params.applicationId)}`
    : "";
  redirect(`/learn/onboarding${q}`);
}
