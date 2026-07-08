import { redirect } from "next/navigation";

/** Public entry — ads and QR codes often land on /join. */
export default function JoinPage() {
  redirect("/kits");
}
