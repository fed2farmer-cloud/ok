import Reveal from "./Reveal";
import { useCountUp } from "./useCountUp";

const HERO_IMG =
  "https://images.pexels.com/photos/33786793/pexels-photo-33786793.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1100&w=1920";

function Stat({ value, prefix = "", suffix = "", label, decimals = 0 }: { value: number; prefix?: string; suffix?: string; label: string; decimals?: number }) {
  const { ref, value: v } = useCountUp(value);
  return (
    <div ref={ref as never} className="flex flex-col gap-1">
      <span className="font-display text-3xl font-medium text-paper-50 sm:text-4xl">
        {prefix}
        {v.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        {suffix}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-paper-50/45">{label}</span>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <img src={HERO_IMG} alt="Aerial view of farmland at sunrise" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/55 to-ink-950" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/30 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-40 sm:pt-44 lg:px-8 lg:pb-24 lg:pt-52">
        <div className="grid items-end gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Copy */}
          <div>
            <Reveal>
              <div className="mb-7 inline-flex items-center gap-2.5 rounded-full bg-paper-50/5 py-1.5 pl-2 pr-4 ring-1 ring-paper-50/15 backdrop-blur-sm">
                <span className="rounded-full bg-moss-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-moss-300 ring-1 ring-moss-400/30">
                  NEW
                </span>
                <span className="text-[12px] font-medium tracking-wide text-paper-50/70">
                  The land-backed lending marketplace · Max 50% LTV
                </span>
              </div>
            </Reveal>

              <Reveal delay={100}>
  <h1 className="font-display text-5xl font-medium tracking-tight text-paper-50 sm:text-7xl">
    Borrow up to 50% of your land value.
  </h1>
</Reveal>

            <Reveal delay={200}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-paper-50/65 sm:text-lg">
                SecuredLanding connects landowners with private investors through loans
                secured by recorded liens on real property — not credit scores. Borrow
                against your equity in days. Invest with a substantial collateral cushion.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#borrow"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-gold-400 px-7 py-3.5 text-sm font-semibold text-ink-950 shadow-[0_8px_30px_rgb(201_161_75/0.35)] transition hover:bg-gold-300"
                >
                  Apply for Land-Backed Loan
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
                <a
                  href="#marketplace"
                  className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold text-paper-50 ring-1 ring-paper-50/25 backdrop-blur-sm transition hover:bg-paper-50/5 hover:ring-paper-50/50"
                >
                  Browse Loan Marketplace
                </a>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <div className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-paper-50/10 pt-8">
                <Stat value={50} suffix="%" label="Max Loan-to-Value" />
               <Stat value={9} suffix="%" label="Fixed Investor Return" />
                <Stat value={72} prefix="48–" suffix="h" label="Approval Window" />
              </div>
            </Reveal>
          </div>

          {/* Floating deal card */}
          <Reveal delay={350} className="hidden lg:block">
            <div className="relative ml-auto w-[380px]">
              <div className="absolute -inset-6 -z-10 rounded-[32px] bg-moss-500/10 blur-3xl" />
              <div className="overflow-hidden rounded-3xl bg-ink-900/80 ring-1 ring-paper-50/12 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-paper-50/8 px-6 py-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-50/45">
                    Live Listing
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-moss-300">
                    <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-moss-400" />
                    Funding Open
                  </span>
                </div>
                <div className="px-6 py-5">
                  <p className="font-display text-xl font-medium text-paper-50">142-Acre Cattle Ranch</p>
                  <p className="mt-1 text-xs text-paper-50/45">Bell County, Texas · First-position deed of trust</p>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[
                      ["$185K", "Loan Amount"],
                      ["9%", "Interest"],
                      ["43%", "LTV"],
                    ].map(([v, l]) => (
                      <div key={l} className="rounded-xl bg-paper-50/5 px-3 py-2.5 ring-1 ring-paper-50/8">
                        <p className="font-mono text-sm font-semibold text-gold-300">{v}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-paper-50/40">{l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <div className="mb-1.5 flex justify-between text-[11px] font-medium">
                      <span className="text-paper-50/50">87% funded</span>
                      <span className="text-paper-50/50">$24,050 remaining</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-50/10">
                      <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-moss-500 to-gold-400" />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-xl bg-moss-500/10 px-4 py-3 ring-1 ring-moss-400/20">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-paper-50/40">Appraised Value</p>
                      <p className="font-mono text-sm font-semibold text-paper-50">$430,000</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-paper-50/40">Equity Cushion</p>
                      <p className="font-mono text-sm font-semibold text-moss-300">$245,000</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
