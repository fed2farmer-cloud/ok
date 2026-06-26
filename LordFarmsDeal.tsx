import { useState } from "react";
import Reveal from "./Reveal";
import { createInvestorReservation, createPlaidLinkToken, orderReportAllPropertyReport } from "./integrations";
import { lordsFarmsDeal, money, percentFunded, remainingFunding } from "./dealData";

const milestones = [
  ["Borrower", lordsFarmsDeal.borrower],
  ["Lead investor", lordsFarmsDeal.leadInvestor],
  ["Funding target", money(lordsFarmsDeal.fundingGoal)],
  ["Already committed", money(lordsFarmsDeal.alreadyFunded)],
];

export default function LordFarmsDeal() {
  const [reservation, setReservation] = useState(1000);
  const [status, setStatus] = useState("Ready for investor reservations.");

  const simulatePlaid = async () => {
    const result = await createPlaidLinkToken("demo-investor", lordsFarmsDeal.id);
    setStatus("Plaid bank verification workflow ready. " + ((result as { message?: string }).message || "Connect Railway backend to activate live Plaid Link."));
  };

  const simulateReportAll = async () => {
    const result = await orderReportAllPropertyReport(lordsFarmsDeal.id, "Los Angeles County", "CA", lordsFarmsDeal.borrower);
    setStatus("ReportAll property-data workflow ready. " + ((result as { message?: string }).message || "Connect Railway backend to order live parcel reports."));
  };

  const reserveInvestment = async () => {
    await createInvestorReservation(lordsFarmsDeal.id, "New Investor", reservation);
    setStatus(`${money(reservation)} reservation recorded in demo mode for ${lordsFarmsDeal.title}.`);
  };

  return (
    <section id="lords-farms" className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(77,124,15,0.20),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(201,161,75,0.13),transparent_30%)]" />
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-moss-400">First Customer · Current Investment</p>
              <h2 className="mt-4 max-w-3xl font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-5xl">
                {lordsFarmsDeal.title}
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-paper-50/60">
                {lordsFarmsDeal.property} This featured listing is seeking {money(lordsFarmsDeal.fundingGoal)} with {money(lordsFarmsDeal.alreadyFunded)} already committed by {lordsFarmsDeal.leadInvestor}.
              </p>
            </div>
            <span className="rounded-full bg-gold-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-950">
              {lordsFarmsDeal.status}
            </span>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal delay={100}>
            <div className="overflow-hidden rounded-[32px] bg-ink-950/80 ring-1 ring-paper-50/10">
              <div className="relative h-72 overflow-hidden">
                <img
                  src="https://images.pexels.com/photos/33786793/pexels-photo-33786793.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1400"
                  alt="Aerial farmland used for Lords Farms investment listing"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="font-display text-2xl font-medium text-paper-50">{lordsFarmsDeal.borrower}</p>
                  <p className="mt-1 text-sm text-paper-50/60">{lordsFarmsDeal.location}</p>
                  <a
                    href={lordsFarmsDeal.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-full bg-paper-50/10 px-4 py-2 text-xs font-semibold text-paper-50 ring-1 ring-paper-50/20 transition hover:bg-paper-50/15"
                  >
                    Visit LordsFarms.com
                  </a>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    [money(lordsFarmsDeal.fundingGoal), "Funding Goal"],
                    [money(lordsFarmsDeal.alreadyFunded), "Funded"],
                    [`${lordsFarmsDeal.rate}%`, "Investor Return"],
                    [`${lordsFarmsDeal.ltv}%`, "Max LTV"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                      <p className="font-mono text-lg font-semibold text-paper-50">{value}</p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-paper-50/40">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-7">
                  <div className="mb-2 flex justify-between text-xs font-medium text-paper-50/55">
                    <span>{percentFunded}% funded</span>
                    <span>{money(remainingFunding)} remaining</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-paper-50/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-moss-500 to-gold-400" style={{ width: `${percentFunded}%` }} />
                  </div>
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-moss-500/10 p-5 ring-1 ring-moss-400/20">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-moss-300">Use of funds</p>
                    <p className="mt-2 text-sm leading-relaxed text-paper-50/65">{lordsFarmsDeal.useOfFunds}</p>
                  </div>
                  <div className="rounded-2xl bg-gold-500/10 p-5 ring-1 ring-gold-400/20">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">Collateral note</p>
                    <p className="mt-2 text-sm leading-relaxed text-paper-50/65">{lordsFarmsDeal.collateral}</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <div className="rounded-[32px] bg-ink-900/80 p-6 ring-1 ring-paper-50/10 sm:p-8">
              <h3 className="font-display text-2xl font-medium text-paper-50">Investor reservation</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper-50/55">
                Reserve a portion of the remaining {money(remainingFunding)}. Plaid verifies bank readiness before funding, and ReportAll powers parcel/title data review before closing.
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                {milestones.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-paper-50/5 p-4 ring-1 ring-paper-50/8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-paper-50/35">{label}</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-paper-50">{value}</p>
                  </div>
                ))}
              </div>

              <label className="mt-7 block text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-50/45">
                Reservation Amount
                <input
                  type="range"
                  min={100}
                  max={remainingFunding}
                  step={100}
                  value={reservation}
                  onChange={(e) => setReservation(Number(e.target.value))}
                  className="mt-3 w-full"
                />
              </label>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-2xl font-semibold text-gold-300">{money(reservation)}</span>
                <span className="text-xs text-paper-50/45">minimum $100</span>
              </div>

              <div className="mt-7 grid gap-3">
                <button onClick={reserveInvestment} className="rounded-full bg-gold-400 px-6 py-3 text-sm font-bold text-ink-950 transition hover:bg-gold-300">
                  Reserve Investment
                </button>
                <a
                  href={lordsFarmsDeal.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-gradient-to-r from-moss-500 to-emerald-400 px-6 py-3 text-center text-sm font-bold text-ink-950 shadow-[0_10px_28px_rgba(34,197,94,0.22)] transition hover:bg-moss-400"
                >
                  Visit LordsFarms.com
                </a>
                <button onClick={simulatePlaid} className="rounded-full px-6 py-3 text-sm font-semibold text-paper-50 ring-1 ring-paper-50/20 transition hover:ring-paper-50/45">
                  Test Plaid Bank Verification
                </button>
                <button onClick={simulateReportAll} className="rounded-full px-6 py-3 text-sm font-semibold text-paper-50 ring-1 ring-paper-50/20 transition hover:ring-paper-50/45">
                  Test ReportAll Property Report
                </button>
              </div>

              <p className="mt-5 rounded-2xl bg-paper-50/5 p-4 text-xs leading-relaxed text-paper-50/55 ring-1 ring-paper-50/8">
                {status}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
