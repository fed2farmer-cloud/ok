import { useMemo, useState } from "react";
import Reveal from "./Reveal";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const landTypes = ["Farmland", "Ranch", "Timberland", "Recreational", "Vacant / Raw", "Development"];

export default function Calculator() {
  const [value, setValue] = useState(320000);
  const [ltv, setLtv] = useState(45);
  const [term, setTerm] = useState(36);
  const [landType, setLandType] = useState("Farmland");

  const loan = useMemo(() => Math.min(Math.round((value * ltv) / 100 / 500) * 500, 500000), [value, ltv]);
  const rate = useMemo(() => {
    // Indicative rate: lower LTV + shorter term = better pricing (8%–18% band)
    const base = 8 + (ltv / 50) * 6 + (term / 60) * 4;
    return Math.min(Math.max(base, 8), 18);
  }, [ltv, term]);

  const monthly = useMemo(() => {
    const r = rate / 100 / 12;
    return (loan * r) / (1 - Math.pow(1 + r, -term));
  }, [loan, rate, term]);

  const cushion = value - loan;

  return (
    <section id="borrow" className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Copy */}
        <div>
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">For Landowners</p>
            <h2 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-5xl">
              See what your land can <span className="font-medium italic text-gold-300">lend you</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-paper-50/60">
              Loans from <strong className="font-semibold text-paper-50">$5,000 to $500,000</strong>, terms of{" "}
              <strong className="font-semibold text-paper-50">6 to 60 months</strong>, and rates from{" "}
              <strong className="font-semibold text-paper-50">8% to 18%</strong> — secured by a recorded mortgage
              or deed of trust, never more than 50% of your property's value.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <ul className="mt-9 space-y-4">
              {[
                "No income verification to pre-qualify",
                "Farmers, ranchers, timberland & recreational owners welcome",
                "Keep full use of your land for the life of the loan",
                "48–72 hour target approval, nationwide where permitted",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-paper-50/70">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-moss-400" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={250}>
            <a href="#cta" className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-gold-400 px-7 py-3.5 text-sm font-semibold text-ink-950 transition hover:bg-gold-300">
              Start My Application
              <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </Reveal>
        </div>

        {/* Calculator card */}
        <Reveal delay={200}>
          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-[40px] bg-gold-500/8 blur-3xl" />
            <div className="rounded-3xl bg-ink-900/90 p-7 ring-1 ring-paper-50/12 sm:p-9">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-medium text-paper-50">Land Equity Calculator</h3>
                <span className="rounded-full bg-moss-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-moss-300 ring-1 ring-moss-400/25">
                  Instant Estimate
                </span>
              </div>

              {/* Land type */}
              <div className="mt-7">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">Land Type</label>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {landTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => setLandType(t)}
                      className={
                        landType === t
                          ? "rounded-full bg-paper-50 px-3.5 py-1.5 text-[12px] font-semibold text-ink-950"
                          : "rounded-full px-3.5 py-1.5 text-[12px] font-medium text-paper-50/55 ring-1 ring-paper-50/15 transition hover:ring-paper-50/35"
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="mt-7 space-y-7">
                <div>
                  <div className="mb-2.5 flex items-baseline justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">Appraised Property Value</label>
                    <span className="font-mono text-lg font-semibold text-paper-50">{fmt(value)}</span>
                  </div>
                  <input
                    type="range" min={20000} max={1000000} step={5000} value={value}
                    onChange={(e) => setValue(+e.target.value)}
                    className="w-full bg-paper-50/15"
                    style={{ background: `linear-gradient(to right, var(--color-gold-500) ${((value - 20000) / 980000) * 100}%, rgb(247 245 239 / 0.15) 0)` }}
                  />
                </div>

                <div>
                  <div className="mb-2.5 flex items-baseline justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">Loan-to-Value (max 50%)</label>
                    <span className="font-mono text-lg font-semibold text-paper-50">{ltv}%</span>
                  </div>
                  <input
                    type="range" min={10} max={50} step={1} value={ltv}
                    onChange={(e) => setLtv(+e.target.value)}
                    className="w-full bg-paper-50/15"
                    style={{ background: `linear-gradient(to right, var(--color-gold-500) ${((ltv - 10) / 40) * 100}%, rgb(247 245 239 / 0.15) 0)` }}
                  />
                </div>

                <div>
                  <div className="mb-2.5 flex items-baseline justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">Term</label>
                    <span className="font-mono text-lg font-semibold text-paper-50">{term} months</span>
                  </div>
                  <input
                    type="range" min={6} max={60} step={6} value={term}
                    onChange={(e) => setTerm(+e.target.value)}
                    className="w-full bg-paper-50/15"
                    style={{ background: `linear-gradient(to right, var(--color-gold-500) ${((term - 6) / 54) * 100}%, rgb(247 245 239 / 0.15) 0)` }}
                  />
                </div>
              </div>

              {/* Results */}
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-2xl bg-gradient-to-br from-gold-500/15 to-moss-500/10 p-5 ring-1 ring-gold-500/25">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/50">Estimated Loan Amount</p>
                  <p className="mt-1 font-display text-4xl font-medium text-gold-300">{fmt(loan)}</p>
                </div>
                {[
                  [fmt(Math.round(monthly)), "Est. Monthly Payment"],
                  [`${rate.toFixed(1)}%`, "Indicative Rate"],
                  [fmt(cushion), "Your Retained Equity"],
                  [landType, "Collateral Type"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-paper-50/4 p-4 ring-1 ring-paper-50/8">
                    <p className="font-mono text-base font-semibold text-paper-50">{v}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-paper-50/40">{l}</p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-[11px] leading-relaxed text-paper-50/35">
                Estimates only. Final terms depend on title review, independent appraisal, and underwriting.
                Loans capped at $500,000 and 50% LTV.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
