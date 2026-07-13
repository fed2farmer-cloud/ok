import { useState } from "react";
import { Link } from "react-router-dom";

export default function Calculator() {
  const [value, setValue] = useState(100000);
  const loanAmount = Math.max(0, value) * 0.5;

  return (
    <section id="calculator" className="relative overflow-hidden bg-[#e6d1a9] py-20 sm:py-24">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(30deg,rgba(93,61,25,.15)_12%,transparent_12.5%,transparent_87%,rgba(93,61,25,.15)_87.5%,rgba(93,61,25,.15)),linear-gradient(150deg,rgba(93,61,25,.15)_12%,transparent_12.5%,transparent_87%,rgba(93,61,25,.15)_87.5%,rgba(93,61,25,.15))] [background-size:80px_140px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-800">Land loan calculator</p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-emerald-950 sm:text-5xl">See what your land could unlock.</h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-emerald-950/65">Enter an estimated property value to view a potential maximum loan at 50% loan-to-value. Final terms remain subject to underwriting, title review, and valuation.</p>
          <Link to="/loan-application" className="mt-7 inline-flex rounded-xl bg-emerald-800 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-900">Continue to Application</Link>
        </div>

        <div className="rounded-[2rem] border border-amber-950/10 bg-[#fffaf0] p-6 shadow-2xl shadow-amber-950/10 sm:p-8">
          <label htmlFor="land-value" className="block text-sm font-bold text-emerald-950">Estimated land value</label>
          <div className="mt-3 flex items-center rounded-xl border border-amber-900/15 bg-white px-4 focus-within:ring-2 focus-within:ring-emerald-700/25">
            <span className="font-semibold text-amber-800">$</span>
            <input id="land-value" type="number" min="0" value={value} onChange={(event) => setValue(Number(event.target.value))} className="w-full bg-transparent px-3 py-4 text-lg font-semibold text-emerald-950 outline-none" />
          </div>

          <div className="mt-6 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Estimated maximum at 50% LTV</p>
            <p className="mt-3 font-display text-5xl font-bold text-white">${loanAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-1/2 rounded-full bg-amber-400" /></div>
            <p className="mt-3 text-xs text-white/60">Your land retains an estimated 50% equity cushion at origination.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
