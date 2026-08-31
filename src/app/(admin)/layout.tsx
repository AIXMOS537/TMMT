import Sidebar from "@/components/Sidebar";
import BrandScope from "@/components/brand/BrandScope";
import OfflineSyncBar from "@/components/OfflineSyncBar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandScope>
      <Sidebar />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <OfflineSyncBar />
          {children}
        </div>
      </main>
    </BrandScope>
  );
}
