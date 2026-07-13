import { Link } from "react-router-dom";

const HERO_IMAGE =
  "https://images.pexels.com/photos/440731/pexels-photo-440731.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=2000";

export default function Hero() {
  return (
    <section id="top" className="relative isolate min-h-[680px] overflow-hidden bg-emerald-950">
      <img
        src={HERO_IMAGE}
        alt="Sunrise over cultivated farmland"
        className="absolute inset-0 -z-30 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-20 bg-gradient-to-r from-emerald-950/95 via-emerald-950/72 to-amber-950/20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-emerald-950 via-transparent to-amber-200/15" />
      <div className="absolute -right-28 top-16 -z-10 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl" />

      <div className="mx-auto grid min-h-[680px] max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
        <div className="max-w-3xl text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-emerald-950/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            America's land-backed lending marketplace
          </div>

          <h1 className="mt-7 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Let your land create your
            <span className="block italic text-amber-300">next opportunity.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/78 sm:text-xl">
            Unlock up to 50% of your land's value, or invest in carefully reviewed loans backed by real property and recorded liens.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/loan-application"
              className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-7 py-4 text-base font-bold text-emerald-950 shadow-xl shadow-amber-950/25 transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              Apply for a Land Loan
            </Link>
            <Link
              to="/marketplace"
              className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/18"
            >
              Explore Investments
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/75">
            {["Up to 50% LTV", "$100 minimum investment", "Transparent loan tracking"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-emerald-950">✓</span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-amber-300/25 to-emerald-400/10 blur-xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-emerald-950/78 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Built on real value</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white">Land equity, made useful.</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              Secured Landing brings borrowers and investors together around one of America's most enduring assets: land.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              {[
                ["50%", "Maximum LTV"],
                ["9%", "Target investor rate"],
                ["$100", "Starting investment"],
                ["11", "Planned launch states"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/7 p-4">
                  <p className="font-display text-2xl font-bold text-amber-300">{value}</p>
                  <p className="mt-1 text-xs text-white/55">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Simple. Secure. Grounded.</p>
              <p className="mt-2 text-sm text-white/68">Clear terms, visible progress, and land-backed opportunities in one modern platform.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
