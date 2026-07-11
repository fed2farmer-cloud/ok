import Reveal from "../components/Reveal";
import { lordsFarmsDeal, money, percentFunded, remainingFunding } from "../lib/dealData";

const docs = ["Borrower profile", "Property verification", "Use-of-funds plan", "Funding activity", "Risk disclosure"];
const timeline = [
  ["Application", "Lords Farms profile created and listed as first SecuredLanding customer."],
  ["Funding", `${money(lordsFarmsDeal.alreadyFunded)} committed by ${lordsFarmsDeal.leadInvestor}.`],
  ["Verification", "Plaid and ReportAll workflows are staged for live activation."],
  ["Closing", "Remaining funds release after final document and collateral review."],
];

export default function InvestmentDetails() {
  return (
    <section id="investment-details" className="border-y border-paper-50/8 bg-ink-950 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">Investment Detail Room</p>
              <h2 className="mt-4 max-w-3xl font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-5xl">
                Review the Lords Farms opportunity before investing.
              </h2>
            </div>
            <a href="#lords-farms" className="rounded-full bg-gold-400 px-6 py-3 text-sm font-bold text-ink-950 transition hover:bg-gold-300">
              Invest Now
            </a>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal delay={100}>
            <div className="rounded-[32px] bg-ink-900/80 p-6 ring-1 ring-paper-50/10 sm:p-8">
              <p className="font-display text-2xl font-medium text-paper-50">Funding Summary</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  [money(lordsFarmsDeal.fundingGoal), "Goal"],
                  [money(lordsFarmsDeal.alreadyFunded), "Raised"],
                  [money(remainingFunding), "Remaining"],
                  [`${percentFunded}%`, "Funded"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                    <p className="font-mono text-lg font-semibold text-paper-50">{value}</p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-paper-50/40">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-paper-50/10">
                <div className="h-full rounded-full bg-gradient-to-r from-moss-500 to-gold-400" style={{ width: `${percentFunded}%` }} />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-paper-50/55">
                {lordsFarmsDeal.property} Funds support {lordsFarmsDeal.useOfFunds.toLowerCase()}
              </p>
              <a href={lordsFarmsDeal.website} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-moss-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-moss-400">
                Visit LordsFarms.com
              </a>
            </div>
          </Reveal>

          <Reveal delay={170}>
            <div className="grid gap-6">
              <div className="rounded-[32px] bg-ink-900/80 p-6 ring-1 ring-paper-50/10 sm:p-8">
                <p className="font-display text-2xl font-medium text-paper-50">Documents & Verification</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {docs.map((doc) => (
                    <div key={doc} className="flex items-center justify-between rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                      <span className="text-sm text-paper-50/75">{doc}</span>
                      <span className="rounded-full bg-gold-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-300">Demo</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] bg-ink-900/80 p-6 ring-1 ring-paper-50/10 sm:p-8">
                <p className="font-display text-2xl font-medium text-paper-50">Timeline</p>
                <div className="mt-5 space-y-4">
                  {timeline.map(([title, text]) => (
                    <div key={title} className="rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                      <p className="text-sm font-semibold text-paper-50">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-paper-50/55">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
