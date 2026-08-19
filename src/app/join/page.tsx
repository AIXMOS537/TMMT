import { redirect } from "next/navigation";
import { ghlOffer } from "@/lib/ghl-offers";

/** Ads, QR, and bio links land here — send them into GHL, not the ops kit page. */
export default function JoinPage() {
  redirect(
    ghlOffer("member97", {
      utm_source: "tmmt",
      utm_medium: "join",
      utm_content: "join-page",
    }),
  );
}
