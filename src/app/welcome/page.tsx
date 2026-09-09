import Link from "next/link";
import {
  HERO,
  SECTIONS,
  ACADEMY,
  ACADEMY_CTA,
  HONEST_NOTE,
  STAFF,
  LEGAL_LINKS,
} from "./copy";

export const metadata = {
  title: "TMMT Rentals — cars for rideshare and delivery drivers",
  description:
    "TMMT Rentals rents cars by the week to Uber, Lyft and delivery drivers, and teaches drivers to run a fleet of their own.",
  // Consistent with every other surface on this app, which middleware marks
  // noindex. Making the front door findable is a separate owner decision:
  // it competes with the GHL site for the same searches.
  robots: { index: false, follow: false },
};

/**
 * The public front door on tmmtrentals.com. Middleware rewrites a signed-out
 * "/" here instead of bouncing the visitor to the GHL site, so the brand's own
 * domain shows the brand's own offer. Signed-in "/" is untouched and still
 * renders the staff home.
 */
export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <span className="text-lg font-semibold tracking-wide">TMMT</span>
          <Link
            href={STAFF.href}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:border-white/40 hover:text-white"
          >
            {STAFF.linkLabel}
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#a78bfa]">
            {HERO.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-6xl">{HERO.headline}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">{HERO.subhead}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={HERO.primaryHref}
              className="rounded-lg bg-[#7c3aed] px-8 py-3 text-sm font-semibold text-white hover:bg-[#6d28d9]"
            >
              {HERO.primaryCta}
            </Link>
            <Link
              href={HERO.secondaryHref}
              className="rounded-lg border border-white/25 px-8 py-3 text-sm font-semibold text-white/90 hover:border-white/50 hover:text-white"
            >
              {HERO.secondaryCta}
            </Link>
          </div>
        </section>

        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-5xl gap-12 px-6 py-16 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-bold">{section.heading}</h2>
                <p className="mt-3 leading-relaxed text-white/70">{section.body}</p>
                {section.items && (
                  <ul className="mt-5 space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-white/80">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#a78bfa]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section === ACADEMY && (
                  <Link
                    href={ACADEMY_CTA.href}
                    className="mt-6 inline-block rounded-lg border border-[#a78bfa]/50 px-6 py-2.5 text-sm font-semibold text-[#a78bfa] hover:bg-[#a78bfa]/10"
                  >
                    {ACADEMY_CTA.label}
                  </Link>
                )}
              </section>
            ))}
          </div>
        </div>

        <section className="border-t border-white/10">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <p className="leading-relaxed text-white/60">{HONEST_NOTE}</p>
            <Link
              href={HERO.primaryHref}
              className="mt-8 inline-block rounded-lg bg-[#7c3aed] px-8 py-3 text-sm font-semibold text-white hover:bg-[#6d28d9]"
            >
              {HERO.primaryCta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-white/50">
          <span>TMMT Rentals</span>
          <nav className="flex flex-wrap gap-5" aria-label="Legal">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white/80">
                {link.label}
              </Link>
            ))}
            <Link href={STAFF.href} className="hover:text-white/80">
              {STAFF.label}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
