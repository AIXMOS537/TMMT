import { notFound } from "next/navigation";
import { getIncidentWithAssignments } from "@/lib/dispatch-queries";
import { IncidentDetailClient } from "./IncidentDetailClient";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { incident, assignments } = await getIncidentWithAssignments(id);
  if (!incident) notFound();
  return <IncidentDetailClient initialIncident={incident} initialAssignments={assignments} />;
}
