import { redirect } from "next/navigation";
import { ghlOffer } from "@/lib/ghl-offers";

/**
 * Ads, QR codes and bio links land here.
 *
 * This used to redirect to allinonemanagementsolutions.com — TMMT spent the
 * ad money and the partner got the visitor. ghlOffer now resolves to the live
 * $97 checkout when NEXT_PUBLIC_GHL_CHECKOUT_97 is set, and to TMMT's own
 * lead form when it is not. Either way the destination is ours.
 */
export default function JoinPage() {
  redirect(
    ghlOffer("member97", {
      utm_source: "tmmt",
      utm_medium: "join",
      utm_content: "join-page",
    }),
  );
}
