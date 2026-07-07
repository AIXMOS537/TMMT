import { redirect } from "next/navigation";

/** Public alias — docs and outreach use /fit-test */
export default function FitTestAlias() {
  redirect("/forms/mission-fit");
}
