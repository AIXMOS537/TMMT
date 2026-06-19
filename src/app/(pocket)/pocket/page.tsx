import Link from "next/link";
import { Lock, MessageCircle, GraduationCap, DollarSign, Compass, TrendingUp } from "lucide-react";
import { createSSRClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui";
import {
  isActivePocketMember,
  pocketCheckoutUrl,
  POCKET_TILES,
  type PocketTile,
} from "@/lib/pocket";

export const metadata = {
  title: "AIXMOS Pocket",
  description: "Your credit-guidance coach and earn-as-you-learn hub.",
};

const ICONS: Record<string, React.ReactNode> = {
  assistant: <MessageCircle className="h-5 w-5" />,
  academy: <GraduationCap className="h-5 w-5" />,
  earn: <DollarSign className="h-5 w-5" />,
  compass: <Compass className="h-5 w-5" />,
  climb: <TrendingUp className="h-5 w-5" />,
};

function Tile({ tile, member }: { tile: PocketTile; member: boolean }) {
  const locked = tile.memberOnly && !member;
  const body = (
    <Card
      className={`p-4 h-full transition-shadow ${
        locked ? "opacity-70" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          {ICONS[tile.key]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-gray-900 dark:text-white">{tile.title}</h2>
            {locked && <Lock className="h-3.5 w-3.5 text-gray-400" aria-label="Members only" />}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{tile.blurb}</p>
        </div>
      </div>
    </Card>
  );

  // Locked tiles route to activation instead of the member-only surface.
  const href = locked ? pocketCheckoutUrl() : tile.href;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}

function ActivateCard() {
  return (
    <Card className="p-5 border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/20 mb-5">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        Start your taste — $97/mo Credit Guidance membership
      </h2>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-slate-300">
        Get your AIXMOS Pocket coach, the Academy, and your earn-as-you-refer link.
        Learn the system, earn on real sales, and climb toward running your own
        location. Cancel anytime.
      </p>
      <Link
        href={pocketCheckoutUrl()}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Activate membership
      </Link>
      <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
        Membership is credit <strong>guidance</strong> and education — not credit
        repair, and not a promise of any score or income. Earnings are commission on
        collected sales only.
      </p>
    </Card>
  );
}

export default async function PocketHomePage() {
  let member = false;
  try {
    const supabase = await createSSRClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    member = isActivePocketMember(user);
  } catch {
    member = false; // fail closed — locked tiles route to activation
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AIXMOS Pocket</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Your credit-guidance coach and earn-as-you-learn hub — on every device.
        </p>
      </header>

      {!member && <ActivateCard />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {POCKET_TILES.map((tile) => (
          <Tile key={tile.key} tile={tile} member={member} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-slate-500">
        AIXMOS Pocket is an education &amp; guidance companion — not a credit repair
        organization, attorney, or financial advisor.
      </p>
    </div>
  );
}
