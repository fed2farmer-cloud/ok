import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { cn } from "./cn";
const links = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Borrow", href: "#borrow" },
  { label: "Invest", href: "#invest" },
  { label: "Marketplace", href: "#marketplace" },
  { label: "Lords Farms", href: "#lords-farms" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="#top" className="group flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-moss-500 to-ink-800 shadow-[0_14px_40px_rgba(34,197,94,0.25)] ring-1 ring-gold-300/35">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_28%),radial-gradient(circle_at_80%_85%,rgba(201,161,75,0.35),transparent_32%)]" />
        <svg viewBox="0 0 32 32" className="relative h-7 w-7 text-paper-50" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
          <path d="M6.5 17.5c4.4-1.6 7.1-.7 10.3 1.4 2.7 1.8 5.3 2.1 8.7.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          <path d="M10.2 13.6c2.4-3.2 6.7-4 10-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16 5.5v21M7 16h18" stroke="currentColor" strokeWidth="1" opacity="0.45" />
          <path d="M20.8 8.2l2.5-2.5M8.7 23.3l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-gold-300" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-xl font-semibold tracking-tight", light ? "text-ink-950" : "text-paper-50")}>
          Secured<span className="text-gold-300">Landing</span>
        </span>
        <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.28em] text-paper-50/45 sm:block">
          Land Backed Capital
        </span>
      </span>
    </a>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "border-b border-paper-50/10 bg-ink-950/85 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-wide text-paper-50/75 ring-1 ring-paper-50/10 transition hover:bg-paper-50/8 hover:text-paper-50 hover:ring-paper-50/25"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#invest"
            className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgba(37,99,235,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(37,99,235,0.42)]"
          >
            Start Investing
          </a>
          <a
            href="#borrow"
            className="rounded-full bg-gradient-to-r from-moss-500 to-emerald-400 px-4 py-2 text-[13px] font-semibold text-ink-950 shadow-[0_10px_28px_rgba(34,197,94,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(34,197,94,0.38)]"
          >
            Get a Loan
          </a>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full bg-paper-50 px-4 py-2 text-[13px] font-semibold text-ink-950 ring-1 ring-paper-50/25 transition hover:-translate-y-0.5 hover:bg-gold-200">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <div className="rounded-full bg-paper-50/10 p-1 ring-1 ring-paper-50/15">
              <UserButton />
            </div>
          </SignedIn>
        </div>

        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-paper-50/15 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-paper-50/10 bg-ink-950/95 px-5 pb-6 pt-3 backdrop-blur-xl lg:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-paper-50/5 py-3 text-sm font-medium text-paper-50/75"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <a href="#invest" onClick={() => setOpen(false)} className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 py-2.5 text-center text-sm font-semibold text-white">
                Start Investing
              </a>
              <a href="#borrow" onClick={() => setOpen(false)} className="rounded-full bg-gradient-to-r from-moss-500 to-emerald-400 py-2.5 text-center text-sm font-semibold text-ink-950">
                Get a Loan
              </a>
            </div>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="w-full rounded-full bg-paper-50 py-2.5 text-center text-sm font-semibold text-ink-950">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex justify-center rounded-full bg-paper-50/10 py-2 ring-1 ring-paper-50/15">
                <UserButton />
              </div>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
