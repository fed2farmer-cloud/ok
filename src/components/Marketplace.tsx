import { Link } from "react-router-dom";

const investments = [
  { title: "Texas Ranch Opportunity", location: "West Texas", amount: "$250,000", rate: "9.0%", term: "60 months", funded: 68, image: "https://images.pexels.com/photos/158827/field-corn-air-frisch-158827.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900" },
  { title: "California Farm Loan", location: "Central California", amount: "$500,000", rate: "8.5%", term: "120 months", funded: 42, image: "https://images.pexels.com/photos/1595104/pexels-photo-1595104.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900" },
  { title: "Oregon Timberland Loan", location: "Southern Oregon", amount: "$175,000", rate: "10.0%", term: "36 months", funded: 81, image: "https://images.pexels.com/photos/167698/pexels-photo-167698.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900" },
];

export default function Marketplace() {
  return (
    <section id="invest" className="bg-[#f8f0df] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Featured opportunities</p>
            <h2 className="mt-4 font-display text-4xl font-semibold text-emerald-950 sm:text-5xl">Invest where the value is tangible.</h2>
            <p className="mt-4 text-base leading-relaxed text-emerald-950/60">Preview land-backed opportunities with transparent rates, terms, and funding progress.</p>
          </div>
          <Link to="/marketplace" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-800/25 bg-white/60 px-5 py-3 text-sm font-bold text-emerald-900 transition hover:bg-white">View Full Marketplace</Link>
        </div>

        <div className="mt-10 grid gap-7 lg:grid-cols-3">
          {investments.map((loan) => (
            <article key={loan.title} className="group overflow-hidden rounded-[1.75rem] border border-amber-900/10 bg-[#fffaf0] shadow-[0_16px_45px_rgba(70,49,19,.10)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(70,49,19,.16)]">
              <div className="relative h-48 overflow-hidden">
                <img src={loan.image} alt={loan.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/75 via-transparent to-transparent" />
                <span className="absolute bottom-4 left-4 rounded-full bg-[#fffaf0]/95 px-3 py-1.5 text-xs font-bold text-emerald-900 shadow">{loan.location}</span>
              </div>
              <div className="p-6">
                <h3 className="font-display text-2xl font-semibold text-emerald-950">{loan.title}</h3>
                <div className="mt-5 grid grid-cols-3 gap-3 border-y border-amber-900/10 py-4">
                  <div><p className="text-[11px] uppercase tracking-wide text-emerald-950/45">Loan</p><p className="mt-1 text-sm font-bold text-emerald-950">{loan.amount}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-emerald-950/45">Rate</p><p className="mt-1 text-sm font-bold text-amber-700">{loan.rate}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-emerald-950/45">Term</p><p className="mt-1 text-sm font-bold text-emerald-950">{loan.term}</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs font-semibold text-emerald-950/60"><span>Funding progress</span><span>{loan.funded}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-900/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-amber-500" style={{ width: `${loan.funded}%` }} /></div>
                <Link to="/marketplace" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-800 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-900">View Opportunity</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
