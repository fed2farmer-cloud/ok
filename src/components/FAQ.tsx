import { useState } from "react";
import Reveal from "./Reveal";
import { cn } from "../lib/cn";

const faqs = [
  [
    "How much can I borrow against my land?",
    "Loans range from $5,000 to $500,000, capped at 50% of your property's independently appraised value. A $200,000 property supports a maximum loan of $100,000. Terms run 6 to 60 months at rates between 8% and 18%.",
  ],
  [
    "Do I need good credit or income verification?",
    "No. SecuredLanding underwrites the land, not your paycheck. We verify ownership, run a title search, review tax status, and order an independent valuation. Your equity is your qualification.",
  ],
  [
    "What types of land qualify?",
    "Farmland, ranches, timberland, recreational and hunting properties, vacant acreage, and development parcels across all U.S. states where legally permitted.",
  ],
  [
    "How are investors protected?",
    "Every loan is secured by a recorded mortgage or deed of trust — first-position wherever possible. The 50% LTV ceiling means collateral is appraised at no less than twice the loan balance at origination, and a defined foreclosure-recovery process returns sale proceeds to investors first.",
  ],
  [
    "What returns can investors expect?",
    "Loans carry rates of 8–18%, with investors targeting 8–15% net annual returns after platform fees (a 1% annual servicing fee and 0.25%–1.00% management fee). Distributions of principal and interest are paid monthly.",
  ],
  [
    "Who can invest on the platform?",
    "Accredited investors, family offices, private funds, and self-directed IRA holders. All investors complete KYC/AML verification, and the platform operates within SEC and state lending frameworks.",
  ],
  [
    "What fees do borrowers pay?",
    "An origination fee of 2%–5% of the loan amount, typically deducted from proceeds at closing. For example, a $100,000 loan with a 3% fee nets $97,000 at funding. There are no application fees to pre-qualify.",
  ],
  [
    "How fast is the process?",
    "Our target approval window is 48–72 hours from a completed application — title work, valuation, and risk scoring are largely automated. Funding follows as soon as investors fill the loan, often within days.",
  ],
] as const;

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-4xl px-5 py-24 lg:px-8 lg:py-32">
      <Reveal className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">FAQ</p>
        <h2 className="mt-4 font-display text-3xl font-light tracking-tight text-paper-50 sm:text-5xl">
          Straight answers, <span className="italic text-gold-300">no fine print games</span>
        </h2>
      </Reveal>

      <div className="mt-14 divide-y divide-paper-50/8 rounded-3xl bg-ink-900/50 ring-1 ring-paper-50/8">
        {faqs.map(([q, a], i) => (
          <Reveal key={q} delay={i * 40}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-6 px-7 py-5 text-left transition hover:bg-paper-50/3"
            >
              <span className="font-display text-[17px] font-medium text-paper-50">{q}</span>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-paper-50/15 transition-transform duration-300",
                  open === i && "rotate-45 bg-gold-400 text-ink-950 ring-gold-400"
                )}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </button>
            <div
              className={cn(
                "grid transition-all duration-400 ease-out",
                open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <p className="px-7 pb-6 text-[14.5px] leading-relaxed text-paper-50/60">{a}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
