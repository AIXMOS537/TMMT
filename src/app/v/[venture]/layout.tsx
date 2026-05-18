import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getVentureBySlug } from "@/lib/ventures";

export default async function VentureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venture: string }>;
}) {
  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture || venture.status !== "active") notFound();

  return (
    <>
      <Sidebar
        ventureSlug={slug}
        ventureName={venture.name}
        ventureColor={venture.color}
      />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
}
