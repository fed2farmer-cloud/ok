import Reveal from "./Reveal";

const problems = [
  "Banks routinely decline loans against vacant or rural land",
  "Agricultural lending demands years of income documentation",
  "Conventional approvals drag on for months, not days",
  "Trillions in land equity sits trapped and unusable",
];

const solutions = [
  ["Asset-first underwriting", "Loans are secured by recorded liens against real property — your land qualifies you, not your W-2."],
  ["A 50% LTV hard ceiling", "On a $200,000 property, the maximum loan is $100,000. That cushion protects every investor on the platform."],
  ["Verified, end to end", "Ownership confirmation, title reports, independent appraisals, and automated risk scoring on every listing."],
  ["Capital in days", "Digital application to funded loan with a 48–72 hour target approval window."],
] as const;

export default function ProblemSolution() {
  return (
    <section className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="grid gap-16 lg:grid-cols-2 lg:gap-20">
        {/* Problem */}
        <div>
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">The Problem</p>
            <h2 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-[42px]">
              Millions of landowners are <span className="italic text-paper-50/55">equity-rich</span> and{" "}
              <span className="italic text-paper-50/55">capital-poor</span>.
            </h2>
          </Reveal>
          <ul className="mt-10 space-y-0">
            {problems.map((p, i) => (
              <Reveal key={p} delay={i * 90} as="li">
                <div className="flex items-start gap-4 border-b border-paper-50/8 py-5">
                  <span className="mt-0.5 font-mono text-xs text-paper-50/30">0{i + 1}</span>
                  <p className="text-[15px] leading-relaxed text-paper-50/70">{p}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={380}>
            <p className="mt-8 text-sm leading-relaxed text-paper-50/45">
              Meanwhile, investors chase yield in markets with little to no collateral —
              accepting risk that land-backed lending was built to eliminate.
            </p>
          </Reveal>
        </div>

        {/* Solution */}
        <div>
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-moss-400">The SecuredLanding Way</p>
            <h2 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-[42px]">
              Lending anchored to <span className="font-medium text-gold-300">real ground.</span>
            </h2>
          </Reveal>
          <div className="mt-10 space-y-4">
            {solutions.map(([title, body], i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="group rounded-2xl bg-ink-900/70 p-6 ring-1 ring-paper-50/8 transition duration-300 hover:bg-ink-850 hover:ring-gold-500/25">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-moss-500/15 ring-1 ring-moss-400/25">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-moss-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <h3 className="font-display text-lg font-medium text-paper-50">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-paper-50/55">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
