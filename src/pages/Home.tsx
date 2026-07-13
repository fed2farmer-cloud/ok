import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Hero from "../components/Hero";
import Calculator from "../components/Calculator";
import Marketplace from "../components/Marketplace";
import Security from "../components/Security";
import Footer from "../components/Footer";

const paths = [
  {
    eyebrow: "For Landowners",
    title: "Turn land equity into working capital",
    body: "Apply for financing using eligible land as collateral, with clear terms and a maximum loan-to-value of 50%.",
    href: "/loan-application",
    cta: "Start an Application",
    icon: "🌾",
  },
  {
    eyebrow: "For Investors",
    title: "Invest in opportunities backed by land",
    body: "Review approved listings, understand the collateral, and invest with transparent funding and repayment tracking.",
    href: "/marketplace",
    cta: "Browse Opportunities",
    icon: "🏡",
  },
  {
    eyebrow: "For Your Future",
    title: "A platform designed around real assets",
    body: "Secure workflows, borrower videos, property records, loan timelines, and document tracking—all in one place.",
    href: "/signup",
    cta: "Create an Account",
    icon: "🛡️",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f1e4] text-emerald-950">
      <Nav />
      <Hero />

      <section className="border-y border-amber-900/10 bg-[#efe2c7]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-amber-900/10 sm:grid-cols-4">
          {[
            ["50%", "Maximum loan-to-value"],
            ["$100", "Minimum investment"],
            ["9%", "Target investor interest"],
            ["11", "Planned launch states"],
          ].map(([value, label]) => (
            <div key={label} className="bg-[#efe2c7] px-5 py-7 text-center">
              <p className="font-display text-3xl font-bold text-emerald-800 sm:text-4xl">{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-amber-950/55">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative overflow-hidden px-5 py-20 sm:py-24">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_10%,rgba(217,164,65,.22),transparent_30%),radial-gradient(circle_at_90%_80%,rgba(28,90,59,.16),transparent_35%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Built for both sides of the land market</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-emerald-950 sm:text-5xl">Choose your Secured Landing path</h2>
            <p className="mt-5 text-base leading-relaxed text-emerald-950/60">A warmer, clearer way to borrow against land or participate in land-backed lending opportunities.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {paths.map((path) => (
              <article key={path.title} className="group rounded-[1.75rem] border border-amber-900/10 bg-[#fffaf0] p-7 shadow-[0_18px_60px_rgba(71,52,25,.10)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(71,52,25,.16)] sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-800 text-2xl shadow-lg">{path.icon}</div>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{path.eyebrow}</p>
                <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-emerald-950">{path.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-emerald-950/62">{path.body}</p>
                <Link to={path.href} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 transition group-hover:text-amber-700">
                  {path.cta}<span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Calculator />
      <Marketplace />
      <Security />
      <Footer />
    </div>
  );
}
