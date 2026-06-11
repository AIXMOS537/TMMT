import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { Coins, Link2, ShieldCheck, ArrowRight } from "lucide-react";

const APPLY_URL = process.env.NEXT_PUBLIC_AFFILIATE_APPLY_URL || "https://tally.so/r/REPLACE_ME";

const bullets = [
  {
    icon: Coins,
    title: "30% recurring, paid monthly",
    body: "About $29/mo per active member, every month they stay. Volume tiers up to 40%.",
  },
  {
    icon: Link2,
    title: "You share — we sell",
    body: "Your unique referral link does the work. Our team coaches every member after they join.",
  },
  {
    icon: ShieldCheck,
    title: "Compliant by design",
    body: "We coach, we never promise. You're never on the hook for outcomes.",
  },
];

export default function AffiliateLanding() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-16 px-6">
      <div className="mx-auto max-w-3xl">
        <header className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
            AIXMOS Affiliate Program
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Get paid every month for every member you bring.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            AIXMOS pays you 30% recurring — about $29 every month — for every active $97 Academy
            member you refer, with volume tiers up to 40%. We coach, we support, we deliver the
            plan. You share the link and get paid monthly, for as long as they stay.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3 mb-12">
          {bullets.map((b) => (
            <Card key={b.title} className="p-6">
              <b.icon className="h-8 w-8 text-emerald-500 dark:text-emerald-400 mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{b.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{b.body}</p>
            </Card>
          ))}
        </div>

        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Apply in 2 minutes
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-md mx-auto">
            Five questions. We review within 48 hours. If you&apos;re approved, you get your unique link,
            a starter kit, and an invite to our affiliate Slack channel.
          </p>
          <Link href={APPLY_URL} target="_blank" rel="noopener noreferrer">
            <Button className="inline-flex items-center gap-2">
              Apply to become an affiliate
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
            Open to anyone with an audience, list, or warm network. No experience required.
          </p>
        </Card>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8 max-w-xl mx-auto">
          AIXMOS provides coaching and planning services only. We do not guarantee credit score outcomes,
          approval for any financial product, or specific funding amounts. Affiliates must follow the
          AIXMOS communication standards — see the starter kit for details.
        </p>
      </div>
    </div>
  );
}
