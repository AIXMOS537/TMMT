import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe("dispatch RLS isolation", () => {
  test("tmmt-test sees only TMMT row; pilot-test sees only Pilot row", async () => {
    test.skip(
      !process.env.E2E_TMMT_EMAIL || !process.env.E2E_PILOT_EMAIL,
      "E2E_*_EMAIL env vars not set — owner must create two Auth users + seed two incidents per the plan first"
    );

    const t = createClient(URL, ANON);
    await t.auth.signInWithPassword({
      email: process.env.E2E_TMMT_EMAIL!,
      password: process.env.E2E_TMMT_PASSWORD!,
    });
    const { data: tRows } = await t.from("incidents").select("ref_code");
    expect(tRows?.map(r => r.ref_code)).toContain("DSP-2026-99001");
    expect(tRows?.map(r => r.ref_code)).not.toContain("DSP-2026-99002");

    const p = createClient(URL, ANON);
    await p.auth.signInWithPassword({
      email: process.env.E2E_PILOT_EMAIL!,
      password: process.env.E2E_PILOT_PASSWORD!,
    });
    const { data: pRows } = await p.from("incidents").select("ref_code");
    expect(pRows?.map(r => r.ref_code)).toContain("DSP-2026-99002");
    expect(pRows?.map(r => r.ref_code)).not.toContain("DSP-2026-99001");
  });
});
