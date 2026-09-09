import Link from "next/link";
import { formsForSite, FORM_FAMILY_COLOR, type FormSite } from "@/lib/forms/catalog";
import { siteFromSearchParam } from "@/lib/forms/site";
import BrandName from "@/components/brand/BrandName";

export const dynamic = "force-dynamic";

export default async function FormsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const sp = await searchParams;
  const site: FormSite = siteFromSearchParam(sp.site) ?? "aixmos";
  const forms = formsForSite(site);
  const full = site === "aixmos";

  return (
    <div className="min-h-screen bg-[#07070c] text-white px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs tracking-[0.28em] uppercase text-cyan-300 mb-3">
          {full ? "AIXMOS · every door" : "TMMT · the short list"}
        </p>
        <h1 className="text-4xl md:text-6xl font-black leading-none mb-3">
          <BrandName /> forms
        </h1>
        <p className="text-zinc-300 max-w-2xl mb-8">
          {full
            ? "Every public form. Name, phone, and email land in one people record in Supabase. Numbers on each card: what it is, what it costs, how long."
            : "The simple TMMT set: rent, waitlist, appointment, ticket, driver check. The big AIXMOS doors (school, $50K box, credit) are on the full list."}
        </p>
        {!full && (
          <p className="mb-8 text-sm">
            Need the full set?{" "}
            <Link className="text-cyan-300 underline" href="/forms?site=aixmos">
              Open every form →
            </Link>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f) => {
            const c = FORM_FAMILY_COLOR[f.family];
            return (
              <Link
                key={f.slug + f.href}
                href={f.href}
                className="rounded-2xl p-4 min-h-[160px] block"
                style={{ background: c.bg, color: c.fg }}
              >
                <div className="text-[10px] tracking-widest uppercase opacity-70">{c.label}</div>
                <div className="text-xl font-black mt-1">{f.title}</div>
                <p className="text-sm font-semibold mt-2 leading-snug">{f.kid}</p>
                <p className="text-xs mt-3 opacity-80">
                  {f.cost} · {f.time}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
