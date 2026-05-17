import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { createSSRClient } from "@/lib/supabase-server";

export async function loadCompanyPolicyText(): Promise<string> {
  try {
    const supabase = await createSSRClient();
    const { data } = await supabase
      .from("company_policies")
      .select("body")
      .eq("slug", "default")
      .eq("active", true)
      .maybeSingle();

    if (data?.body && data.body.length > 200 && !data.body.includes("docs/ops-company-policy")) {
      return data.body;
    }
  } catch {
    // fall through to file
  }

  try {
    const filePath = path.join(process.cwd(), "docs", "ops-company-policy.md");
    return await readFile(filePath, "utf8");
  } catch {
    return "Communicate clearly, honestly, and professionally. Do not promise pricing or outcomes without owner approval.";
  }
}
