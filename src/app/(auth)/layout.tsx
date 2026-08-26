import type { Metadata } from "next";
import BrandScope from "@/components/brand/BrandScope";

export const metadata: Metadata = {
  title: "Sign in · Partner portal & operations",
  description: "Sign in for the operations dashboard or the partner portal.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandScope>
      <div className="min-h-screen flex items-center justify-center px-4">
        {children}
      </div>
    </BrandScope>
  );
}
