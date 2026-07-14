import { useState } from "react";
import { Link } from "react-router-dom";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center" aria-label="Secured Landing home">
      <img
        src="/secured-landing-logo.png"
        alt="Secured Landing — land-backed lending and secure investing"
        className="h-10 w-auto max-w-[185px] object-contain sm:h-12 sm:max-w-[225px]"
      />
    </Link>
  );
}

const PUBLIC_NAV = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#calculator", label: "Borrow" },
  { href: "#invest", label: "Invest" },
  { href: "#security", label: "Security" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-amber-900/10 bg-[#fffaf0]/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Logo />

        <div className="hidden items-center gap-7 text-sm font-semibold text-emerald-950/75 md:flex">
          {PUBLIC_NAV.map((item) => (
            <a key={item.href} href={item.href} className="transition hover:text-amber-700">
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <Link to="/login" className="rounded-xl border border-emerald-800/25 px-4 py-2.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50">
            Log In
          </Link>
          <Link to="/signup" className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-emerald-900">
            Get Started
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-emerald-950 hover:bg-amber-100 sm:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-amber-900/10 bg-[#fffaf0] px-4 pb-5 pt-3 sm:hidden">
          <div className="flex flex-col gap-1">
            {PUBLIC_NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-emerald-950/75 hover:bg-amber-100">
                {item.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/login" className="rounded-xl border border-emerald-800/25 px-4 py-3 text-center text-sm font-bold text-emerald-900">Log In</Link>
              <Link to="/signup" className="rounded-xl bg-emerald-800 px-4 py-3 text-center text-sm font-bold text-white">Get Started</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
