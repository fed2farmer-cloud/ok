import Reveal from "./Reveal";
import { lordsFarmsDeal, money, remainingFunding } from "./dealData";

const investorStats = [
  [money(lordsFarmsDeal.alreadyFunded), "Portfolio Value"],
  ["1", "Active Investment"],
  [`${lordsFarmsDeal.rate}%`, "Target Return"],
  ["Ready", "Plaid Status"],
];

const borrowerTasks = [
  ["Bank connection", "Plaid workflow staged"],
  ["Property report", "ReportAll workflow staged"],
  ["Funding status", `${money(remainingFunding)} remaining`],
  ["Documents", "Upload room ready"],
];

export default function Dashboards() {
  return (
    <section id="dashboards" className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(34,197,94,0.13),transparent_32%)]" />
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-moss-400">Investor & Borrower Portals</p>
          <h2 className="mt-4 max-w-3xl font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-5xl">
            Dashboards are staged for live Railway data.
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-paper-50/55">
            This version adds premium dashboard previews. The next backend step connects Railway/PostgreSQL so these cards update from real users, loans, investments, and verification events.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal delay={100}>
            <div className="rounded-[32px] bg-ink-900/80 p-6 ring-1 ring-paper-50/10 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300">Investor Dashboard</p>
                  <h3 className="mt-2 font-display text-2xl font-medium text-paper-50">Melvin Askew portfolio</h3>
                </div>
                <span className="rounded-full bg-gold-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-950">Demo</span>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {investorStats.map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                    <p className="font-mono text-lg font-semibold text-paper-50">{value}</p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-paper-50/40">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 rounded-2xl bg-moss-500/10 p-5 ring-1 ring-moss-400/20">
                <p className="text-sm font-semibold text-paper-50">Lords Farms LLC</p>
                <p className="mt-1 text-sm text-paper-50/55">Current commitment by Melvin Askew: {money(lordsFarmsDeal.alreadyFunded)}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="rounded-[32px] bg-ink-900/80 p-6 ring-1 ring-paper-50/10 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-moss-300">Borrower Dashboard</p>
                  <h3 className="mt-2 font-display text-2xl font-medium text-paper-50">Lords Farms funding room</h3>
                </div>
                <span className="rounded-full bg-moss-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Open</span>
              </div>
              <div className="mt-7 space-y-3">
                {borrowerTasks.map(([task, status]) => (
                  <div key={task} className="flex items-center justify-between gap-4 rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                    <span className="text-sm text-paper-50/75">{task}</span>
                    <span className="text-right text-xs font-semibold text-gold-300">{status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <a href="#integrations" className="rounded-full bg-blue-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-400">Connect Plaid</a>
                <a href="#integrations" className="rounded-full bg-gold-400 px-5 py-3 text-center text-sm font-bold text-ink-950 transition hover:bg-gold-300">Run ReportAll</a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
