import Reveal from "./Reveal";
import { lordsFarmsDeal, money, percentFunded } from "./dealData";

const listings = [
  {
    img: "https://images.pexels.com/photos/33786793/pexels-photo-33786793.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=420&w=640",
    title: lordsFarmsDeal.title,
    location: lordsFarmsDeal.location,
    type: "Current Investment",
    amount: money(lordsFarmsDeal.fundingGoal),
    appraised: "ReportAll pending",
    ltv: lordsFarmsDeal.ltv,
    rate: `${lordsFarmsDeal.rate}%`,
    term: `${lordsFarmsDeal.termMonths} mo`,
    funded: percentFunded,
    grade: lordsFarmsDeal.grade,
  },
  {
    img: "https://images.pexels.com/photos/10097298/pexels-photo-10097298.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=420&w=640",
    title: "Timberland Tract · 210 Acres",
    location: "Rabun County, Georgia",
    type: "Timberland",
    amount: "$155,000",
    appraised: "$390,000",
    ltv: 40,
    rate: "10.4%",
    term: "48 mo",
    funded: 91,
    grade: "A",
  },
  {
    img: "https://images.pexels.com/photos/16547162/pexels-photo-16547162.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=420&w=640",
    title: "Hunting & Recreation · 64 Acres",
    location: "Ozark County, Missouri",
    type: "Recreational",
    amount: "$68,000",
    appraised: "$148,000",
    ltv: 46,
    rate: "13.8%",
    term: "24 mo",
    funded: 38,
    grade: "B+",
  },
  {
    img: "https://images.pexels.com/photos/20858786/pexels-photo-20858786.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=420&w=640",
    title: "Development Parcel · 18 Acres",
    location: "Maricopa County, Arizona",
    type: "Development",
    amount: "$310,000",
    appraised: "$700,000",
    ltv: 44,
    rate: "12.6%",
    term: "18 mo",
    funded: 72,
    grade: "A-",
  },
  {
    img: "https://images.pexels.com/photos/37481140/pexels-photo-37481140.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=420&w=640",
    title: "Pasture & Grazing · 145 Acres",
    location: "Custer County, Nebraska",
    type: "Ranch",
    amount: "$120,000",
    appraised: "$265,000",
    ltv: 45,
    rate: "10.9%",
    term: "60 mo",
    funded: 55,
    grade: "A",
  },
  {
    img: "https://images.pexels.com/photos/31639625/pexels-photo-31639625.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=420&w=640",
    title: "Vacant Acreage · 32 Acres",
    location: "Kerr County, Texas",
    type: "Vacant Land",
    amount: "$52,500",
    appraised: "$118,000",
    ltv: 44,
    rate: "14.5%",
    term: "12 mo",
    funded: 83,
    grade: "B+",
  },
];

export default function Marketplace() {
  return (
    <section id="marketplace" className="relative border-y border-paper-50/8 bg-ink-900/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">The Marketplace</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl font-light leading-tight tracking-tight text-paper-50 sm:text-5xl">
              Every listing, <span className="italic text-gold-300">title-verified</span> and appraised
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <a href="#cta" className="group inline-flex items-center gap-2 text-sm font-semibold text-gold-300 transition hover:text-gold-200">
              View all open loans
              <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l, i) => (
            <Reveal key={l.title} delay={(i % 3) * 100}>
              <article className="group overflow-hidden rounded-3xl bg-ink-950/80 ring-1 ring-paper-50/8 transition duration-300 hover:-translate-y-1.5 hover:ring-gold-500/30 hover:shadow-[0_24px_60px_rgb(0_0_0/0.45)]">
                <div className="relative h-44 overflow-hidden">
                  <img src={l.img} alt={l.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-transparent to-ink-950/20" />
                  <span className="absolute left-4 top-4 rounded-full bg-ink-950/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-paper-50/80 ring-1 ring-paper-50/20 backdrop-blur-sm">
                    {l.type}
                  </span>
                  <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 font-mono text-[11px] font-bold text-ink-950">
                    {l.grade}
                  </span>
                  <div className="absolute bottom-3 left-4 right-4">
                    <p className="font-display text-base font-medium text-paper-50">{l.title}</p>
                    <p className="text-[11px] text-paper-50/55">{l.location} · First-position lien</p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      [l.amount, "Loan"],
                      [l.rate, "Rate"],
                      [`${l.ltv}%`, "LTV"],
                      [l.term, "Term"],
                    ].map(([v, lab]) => (
                      <div key={lab} className="rounded-xl bg-paper-50/4 px-1 py-2.5 ring-1 ring-paper-50/6">
                        <p className="font-mono text-[12.5px] font-semibold text-paper-50">{v}</p>
                        <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-paper-50/40">{lab}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] font-medium text-paper-50/45">
                      <span>{l.funded}% funded</span>
                      <span>Appraised {l.appraised}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-50/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-moss-500 to-gold-400 transition-all duration-700" style={{ width: `${l.funded}%` }} />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <a href={i === 0 ? "#lords-farms" : "#marketplace"} className="rounded-full bg-gold-400 px-4 py-2.5 text-center text-xs font-bold text-ink-950 transition hover:bg-gold-300">
                      Invest Now
                    </a>
                    <a href={i === 0 ? "#investment-details" : "#marketplace"} className="rounded-full px-4 py-2.5 text-center text-xs font-bold text-paper-50 ring-1 ring-paper-50/20 transition hover:ring-paper-50/45">
                      View Details
                    </a>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={150}>
          <p className="mt-10 text-center text-[11px] text-paper-50/30">
            Sample listings shown for illustration. All marketplace loans include title reports, independent valuations, and recorded security instruments.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
