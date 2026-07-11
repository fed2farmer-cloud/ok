import { useState } from "react";

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-3">
      <img src="/Logo.png" alt="SecuredLanding" className="h-9 w-9 object-contain" />
      <span className={`font-display text-lg font-semibold ${dark ? "text-paper-50" : "text-slate-950"}`}>
        SecuredLanding
      </span>
    </a>
  );
}

const PUBLIC_NAV = [
  { href: "#calculator", label: "Calculator" },
  { href: "#invest", label: "Invest" },
  { href: "#security", label: "Security" },
  { href: "#contact", label: "Contact" },
];

/** Public marketing nav — used on the Home page */
export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo />

        {/* Desktop links */}
        <div className="hidden gap-6 text-sm font-medium text-slate-700 sm:flex">
          {PUBLIC_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition hover:text-emerald-600"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <a
            href="/login"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Log In
          </a>
          <a
            href="/signup"
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Get Started
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 sm:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-5 pt-3 sm:hidden">
          <div className="flex flex-col gap-1">
            {PUBLIC_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <a
                href="/login"
                className="rounded-lg border border-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700"
              >
                Log In
              </a>
              <a
                href="/signup"
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}