import Link from "next/link";
import type { Metadata } from "next";
import { getPublicFleet, vehicleName, weeklyPrice } from "@/lib/fleet/public-fleet";
import { crossSellServices } from "@/lib/business-lines/cross-sell";

/**
 * The rental front door.
 *
 * Reached at "/" — middleware rewrites a signed-out visitor here rather than
 * redirecting, so the brand's own address stays in the address bar. Until now "/"
 * sent that visitor to /login, which meant someone who wanted to rent a car was
 * shown a staff sign-in screen and left.
 *
 * The copy says only what is true. TMMT screens on license, platform activation and
 * ability to pay weekly, not on a credit score; it is not a loan and not credit
 * repair; and not everyone qualifies. Rates come from the fleet table rather than
 * being written into the page, so this cannot drift away from what is actually
 * being rented.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TMMT Rentals — weekly car rental for rideshare and delivery drivers",
  description:
    "Weekly car rental for rideshare and delivery drivers. Screened on your license and platform activation, not your credit score.",
};

const QUALIFY = [
  "A valid driver's license you've held for a while",
  "An active rideshare or delivery account (Uber, Lyft, DoorDash and the like)",
  "Enough hours on the road to cover the weekly payment",
  "A clean enough driving record for our insurance",
] as const;

export default async function WelcomePage() {
  const fleet = await getPublicFleet();
  const services = crossSellServices();

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0A1628]">
      <header className="border-b border-[#dbe4f5] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold tracking-tight">TMMT Rentals</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-[#41527a] hover:text-[#0A1628]" href="/forms/waitlist">
              Waitlist
            </Link>
            {/* Staff door. Small and out of the way — this page is for renters. */}
            <Link
              className="rounded-lg border border-[#c8d5ee] px-3 py-1.5 font-medium text-[#41527a] hover:bg-[#eef3fc]"
              href="/login"
            >
              Staff sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-12 sm:py-16">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
            Weekly car rental for rideshare and delivery drivers.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#41527a]">
            Rent by the week and drive for Uber, Lyft, DoorDash or anyone else. We look
            at your license, your driving account and whether the weekly payment works
            for you — <strong className="font-semibold text-[#0A1628]">not your credit score</strong>.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded-xl bg-[#0A1628] px-6 py-3 text-center font-semibold text-white hover:bg-[#16233d]"
              href="/forms/lead-intake"
            >
              Rent a car
            </Link>
            <Link
              className="rounded-xl border border-[#c8d5ee] bg-white px-6 py-3 text-center font-semibold text-[#0A1628] hover:bg-[#eef3fc]"
              href="/forms/waitlist"
            >
              Join the waitlist
            </Link>
          </div>
          <p className="mt-3 text-sm text-[#5a6b91]">
            Not everyone qualifies, and we&apos;ll tell you either way. This is a
            rental — not a loan, and not credit repair.
          </p>
        </section>

        <section className="pb-12">
          <h2 className="text-xl font-bold">What we rent</h2>
          {fleet.ok && fleet.vehicles.length > 0 ? (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fleet.vehicles.map((v) => {
                  const price = weeklyPrice(v);
                  return (
                    <div
                      key={v.id}
                      className="rounded-xl border border-[#dbe4f5] bg-white p-5"
                    >
                      <p className="text-lg font-semibold">{vehicleName(v)}</p>
                      <p className="mt-1 text-[#41527a]">
                        {/* No rate on the row means no price shown, never "$0". */}
                        {price ? (
                          <>
                            <span className="text-xl font-bold text-[#0A1628]">{price}</span>
                            <span className="text-sm"> / week</span>
                          </>
                        ) : (
                          <span className="text-sm">Ask us about weekly pricing</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-[#5a6b91]">
                This is the current fleet, not a live availability board — a car listed
                here may already be out with a driver. Ask and we&apos;ll tell you what
                is free this week.
              </p>
            </>
          ) : fleet.ok ? (
            <p className="mt-4 rounded-xl border border-[#dbe4f5] bg-white p-5 text-[#41527a]">
              Nothing is on the lot right now. Tell us what you&apos;re looking for and
              what you can pay weekly, and you&apos;ll be first to hear when it lands —{" "}
              <Link className="font-semibold text-[#0A1628] underline" href="/forms/waitlist">
                join the waitlist
              </Link>
              .
            </p>
          ) : (
            /* Could not reach the fleet. Say that, rather than showing an empty lot. */
            <p className="mt-4 rounded-xl border border-[#dbe4f5] bg-white p-5 text-[#41527a]">
              We can&apos;t load the fleet list at the moment.{" "}
              <Link className="font-semibold text-[#0A1628] underline" href="/forms/lead-intake">
                Send us what you need
              </Link>{" "}
              and we&apos;ll come back to you with what&apos;s available.
            </p>
          )}
        </section>

        <section className="pb-12">
          <h2 className="text-xl font-bold">What you need to qualify</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {QUALIFY.map((q) => (
              <li
                key={q}
                className="rounded-xl border border-[#dbe4f5] bg-white p-4 text-[#41527a]"
              >
                {q}
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-12">
          <h2 className="text-xl font-bold">How it works</h2>
          <ol className="mt-4 space-y-3">
            {[
              ["Tell us what you need", "Two minutes. Name, number, and the kind of car."],
              ["We check you're a fit", "License, driving account, and the weekly number."],
              ["Pick up and drive", "Paperwork and keys — then the car is yours by the week."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4 rounded-xl border border-[#dbe4f5] bg-white p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A1628] font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="text-[#41527a]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-12">
          <h2 className="text-xl font-bold">Other things we do</h2>
          <p className="mt-1 text-[#41527a]">
            TMMT runs more than the rental desk. Each one has its own form.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {services.map((s) => (
              <Link
                key={s.slug}
                className="rounded-lg border border-[#c8d5ee] bg-white px-3 py-2 text-sm font-medium text-[#41527a] hover:bg-[#eef3fc]"
                href={`/forms/${s.slug}`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dbe4f5] bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-[#5a6b91] sm:flex-row sm:items-center sm:justify-between">
          <span>© TMMT Rentals</span>
          <nav className="flex flex-wrap gap-4">
            <Link className="hover:text-[#0A1628]" href="/legal/rental">
              Rental terms
            </Link>
            <Link className="hover:text-[#0A1628]" href="/legal/privacy">
              Privacy
            </Link>
            <Link className="hover:text-[#0A1628]" href="/legal/sms">
              SMS policy
            </Link>
            <Link className="hover:text-[#0A1628]" href="/forms/ticket">
              Get help
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
