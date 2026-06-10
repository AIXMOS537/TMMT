import { redirect } from "next/navigation";
import { workPath } from "@aixmos/core";

export default function SupervisorRedirect() {
  redirect(workPath("/work/supervisor"));
}
