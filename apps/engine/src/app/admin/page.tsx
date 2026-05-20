import { redirect } from "next/navigation";
import { workPath } from "@aixmos/core";

export default function AdminRedirect() {
  redirect(workPath("/work/admin"));
}
