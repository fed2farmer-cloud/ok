import { useState } from "react";
import Reveal from "../components/Reveal";
import { useCountUp } from "../components/useCountUp";

const audiences = [
  {
    title: "Accredited Investors",
    seek: "8–15% target annual returns",
    body: "Earn yield backed by real ground instead of unsecured consumer credit.",
    icon: <path d="M12 2l2.4 7.2H22l-6 4.5 2.3 7.3-6.3-4.5-6.3 4.5L8 13.7 2 9.2h7.6z" />,
  },
  {
    title: "Family Offices",
    seek: "Asset-backed allocations",
    body: "Diversify into short-duration private credit with a recorded lien on every dollar.",
    icon: <><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></>,
  },
  {
    title: "Self-Directed IRAs",
    seek: "Alternative retirement assets",
    body: "Hold collateralized land loans inside tax-advantaged retirement accounts.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  },
  {
    title: "Private Funds",
    seek: "Scalable deal flow",
    body: "Programmatic access to underwritten, first-position land loans nationwide.",
    icon: <><path d="M3 17l5-5 4 4 7-8" /><path d="M15 8h4v4" /></>,
  },
];

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function YieldSim() {
  const [amount, setAmount] = useState(50000);
  const [rate, setRate] = useState(11);
  const annual = (amount * rate) / 100;
  const monthly = annual / 12;
  const fiveYear = amount * Math.pow(1 + rate / 100, 5) - amount;

  return (
    <div className="rounded-3xl bg-ink-950/80 p-7 ring-1 ring-paper-50/10 sm:p-8">
      <h3 className="font-display text-xl font-medium text-paper-50">Projected Yield Simulator</h3>
      <div className="mt-7 space-y-7">
        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">Capital Deployed</label>
            <span className="font-mono text-lg font-semibold text-paper-50">{fmt(amount)}</span>
          </div>
          <input
            type="range" min={5000} max={500000} step={5000} value={amount}
            onChange={(e) => setAmount(+e.target.value)}
            className="w-full bg-paper-50/15"
            style={{ background: `linear-gradient(to right, var(--color-moss-500) ${((amount - 5000) / 495000) * 100}%, rgb(247 245 239 / 0.15) 0)` }}
          />
        </div>
        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">Blended Portfolio Rate</label>
            <span className="font-mono text-lg font-semibold text-paper-50">{rate}%</span>
          </div>
          <input
            type="range" min={8} max={15} step={0.5} value={rate}
            onChange={(e) => setRate(+e.target.value)}
            className="w-full bg-paper-50/15"
            style={{ background: `linear-gradient(to right, var(--color-moss-500) ${((rate - 8) / 7) * 100}%, rgb(247 245 239 / 0.15) 0)` }}
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          [fmt(Math.round(monthly)), "Monthly Income"],
          [fmt(Math.round(annual)), "Annual Income"],
          [fmt(Math.round(fiveYear)), "5-Yr Compounded"],
        ].map(([v, l], i) => (
          <div key={l} className={i === 2 ? "rounded-2xl bg-moss-500/12 p-4 ring-1 ring-moss-400/25" : "rounded-2xl bg-paper-50/4 p-4 ring-1 ring-paper-50/8"}>
            <p className={`font-mono text-sm font-semibold sm:text-base ${i === 2 ? "text-moss-300" : "text-paper-50"}`}>{v}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-paper-50/40">{l}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-paper-50/35">
        Illustrative projections, not a guarantee of performance. Returns depend on loan selection, borrower payment, and recovery outcomes. Management fees of 0.25%–1.00% may apply.
      </p>
    </div>
  );
}

function BigStat({ value, prefix = "", suffix = "", label }: { value: number; prefix?: string; suffix?: string; label: string }) {
  const { ref, value: v } = useCountUp(value);
  return (
    <div ref={ref as never} className="border-l border-paper-50/10 pl-5">
      <p className="font-display text-3xl font-medium text-gold-300 sm:text-4xl">
        {prefix}{Math.round(v).toLocaleString()}{suffix}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-paper-50/45">{label}</p>
    </div>
  );
}

export default function Invest() {
  return (
    <section id="invest" className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div>
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-moss-400">For Investors</p>
            <h2 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-5xl">
              Yield with <span className="font-medium italic text-gold-300">ground</span> beneath it
            </h2>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-paper-50/60">
              Every loan on SecuredLanding is collateralized by real property at a maximum of 50%
              loan-to-value — meaning the land securing your investment is appraised at no less than
              twice the loan balance.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {audiences.map((a, i) => (
              <Reveal key={a.title} delay={i * 80}>
                <div className="h-full rounded-2xl bg-ink-900/70 p-6 ring-1 ring-paper-50/8 transition duration-300 hover:ring-moss-400/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-moss-500/12 ring-1 ring-moss-400/20">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-moss-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      {a.icon}
                    </svg>
                  </span>
                  <h3 className="mt-4 font-display text-base font-medium text-paper-50">{a.title}</h3>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold-400/80">{a.seek}</p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-paper-50/55">{a.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-12 grid grid-cols-3 gap-6">
              <BigStat value={50} suffix="%" label="Max LTV, Always" />
              <BigStat value={100} suffix="%" label="Lien-Secured Loans" />
              <BigStat value={12} label="Monthly Distributions / Yr" />
            </div>
          </Reveal>
        </div>

        <Reveal delay={150} className="lg:sticky lg:top-28 lg:self-start">
          <YieldSim />
        </Reveal>
      </div>
    </section>
  );
}
