import Reveal from "./Reveal";

const pillars = [
  {
    title: "Property Verification",
    body: "Title searches, ownership confirmation, and property-tax status review on every parcel before listing.",
    icon: <><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /></>,
  },
  {
    title: "Independent Valuation",
    body: "Licensed appraisals, automated valuation models, and comparable market analysis — never the borrower's number.",
    icon: <><path d="M3 21h18" /><path d="M6 21V10M12 21V4M18 21v-9" /></>,
  },
  {
    title: "First-Position Liens",
    body: "A recorded mortgage or deed of trust secures each loan, with first-priority interest wherever possible.",
    icon: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  },
  {
    title: "Regulatory Compliance",
    body: "SEC oversight, state lending law, AML/KYC, fair-lending, and consumer-protection frameworks — with specialized securities counsel retained.",
    icon: <><path d="M12 3l8 4v5c0 5-3.6 8.8-8 9-4.4-.2-8-4-8-9V7z" /><path d="M12 8v4M12 15.5v.5" /></>,
  },
];

const waterfall = [
  ["Borrower notified", "Immediate outreach the moment a payment is missed."],
  ["Workout options offered", "Modified schedules and cure periods to get loans back on track."],
  ["Foreclosure initiated", "Recorded lien enforced through the legal process."],
  ["Property sold", "Collateral liquidated — appraised at ≥2× the loan at origination."],
  ["Investors repaid", "Sale proceeds flow to investors first under the recovery waterfall."],
];

export default function Security() {
  return (
    <section id="security" className="relative border-y border-paper-50/8 bg-ink-900/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">Risk Management</p>
          <h2 className="mt-4 font-display text-3xl font-light tracking-tight text-paper-50 sm:text-5xl">
            Engineered so the <span className="italic text-gold-300">collateral</span> does the talking
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-paper-50/55">
            Conservative by design. The 50% LTV ceiling means every loan begins with an equity
            cushion equal to the loan itself — and our process protects it at every step.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <div className="h-full rounded-2xl bg-ink-950/70 p-7 ring-1 ring-paper-50/8 transition duration-300 hover:ring-gold-500/30">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/12 ring-1 ring-gold-500/25">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold-300" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                    {p.icon}
                  </svg>
                </span>
                <h3 className="mt-5 font-display text-lg font-medium text-paper-50">{p.title}</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-paper-50/55">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Recovery waterfall */}
        <Reveal delay={150}>
          <div className="mt-16 rounded-3xl bg-ink-950/70 p-8 ring-1 ring-paper-50/8 sm:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-display text-2xl font-medium text-paper-50">If a loan defaults, the path is already mapped</h3>
              <span className="rounded-full bg-paper-50/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-paper-50/50 ring-1 ring-paper-50/12">
                Recovery Waterfall
              </span>
            </div>
            <div className="mt-9 grid gap-6 sm:grid-cols-5">
              {waterfall.map(([t, b], i) => (
                <div key={t} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400 font-mono text-[12px] font-bold text-ink-950">
                      {i + 1}
                    </span>
                    {i < waterfall.length - 1 && <span className="hidden h-px flex-1 bg-gradient-to-r from-gold-500/50 to-transparent sm:block" />}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-paper-50">{t}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-paper-50/50">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
