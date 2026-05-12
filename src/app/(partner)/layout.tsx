import type { Metadata } from "next";
import PartnerPortalChrome from "./PartnerPortalChrome";

export const metadata: Metadata = {
  title: "Partner portal · TMMT Rentals",
  description:
    "Read-only vehicle program status for TMMT investors and partners.",
};

export default function PartnerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PartnerPortalChrome>{children}</PartnerPortalChrome>;
}
