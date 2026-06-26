import { useState } from "react";
import Reveal from "./Reveal";
import { cn } from "./cn";

const tracks = {
  borrowers: {
    label: "For Landowners",
    steps: [
      ["Apply Online", "Tell us about your property in minutes — acreage, location, and how much capital you need. No income verification required to start."],
      ["We Verify the Land", "Our platform runs title searches, confirms ownership and tax status, and orders an independent appraisal or AVM."],
      ["Get Your Offer", "Receive terms within 48–72 hours: $5K–$500K, 6–60 months, capped at 50% of appraised value."],
      ["Fund & Build", "Investors fund your loan, a lien is recorded, and capital lands in your account. Make monthly payments and keep your land working for you."],
    ],
  },
  investors: {
    label: "For Investors",
    steps: [
      ["Open an Account", "Complete KYC/AML verification as an accredited investor, family office, fund, or self-directed IRA holder."],
      ["Review Vetted Listings", "Every loan ships with a title report, appraisal, risk score, and LTV breakdown. Nothing lists above 50% LTV."],
      ["Fund Fractionally", "Deploy capital across multiple loans, borrowers, states, and land types to diversify your collateral-backed portfolio."],
      ["Collect Monthly", "Receive principal and interest distributions every month, targeting 8–15% annual returns — secured by recorded liens."],
    ],
  },
} as const;

type TrackKey = keyof typeof tracks;

export default function HowItWorks() {
  const [active, setActive] = useState<TrackKey>("borrowers");
  const track = tracks[active];

  return (
    <section id="how-it-works" className="relative border-y border-paper-50/8 bg-ink-900/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">How It Works</p>
          <h2 className="mt-4 font-display text-3xl font-light tracking-tight text-paper-50 sm:text-5xl">
            From dirt to <span className="italic text-gold-300">dollars</span>, in four steps
          </h2>
        </Reveal>

        <Reveal delay={120} className="mt-10 flex justify-center">
          <div className="inline-flex rounded-full bg-ink-950/80 p-1.5 ring-1 ring-paper-50/10">
            {(Object.keys(tracks) as TrackKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  "rounded-full px-6 py-2.5 text-[13px] font-semibold transition-all duration-300",
                  active === key ? "bg-gold-400 text-ink-950 shadow-lg" : "text-paper-50/55 hover:text-paper-50"
                )}
              >
                {tracks[key].label}
              </button>
            ))}
          </div>
        </Reveal>

        <div key={active} className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {track.steps.map(([title, body], i) => (
            <div
              key={title}
              className="group relative animate-fade-up rounded-2xl bg-ink-950/70 p-7 ring-1 ring-paper-50/8 transition duration-300 hover:-translate-y-1 hover:ring-gold-500/30"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <span className="font-display text-5xl font-light text-paper-50/12 transition-colors group-hover:text-gold-500/30">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-display text-lg font-medium text-paper-50">{title}</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-paper-50/55">{body}</p>
              {i < track.steps.length - 1 && (
                <svg viewBox="0 0 24 24" className="absolute -right-3.5 top-9 hidden h-5 w-5 text-paper-50/20 lg:block" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
