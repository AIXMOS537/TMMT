import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · Partner portal & operations",
  description:
    "TMMT Rentals — sign in for the operations dashboard or the partner portal.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {children}
    </div>
  );
}
