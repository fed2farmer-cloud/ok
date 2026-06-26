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
    <a href="#top" className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-moss-500 to-ink-700 ring-1 ring-moss-400/40">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" />
          <path d="M5 21V11l7-6 7 6v10" />
          <path d="M12 21v-4a2 2 0 0 0-4 0v4" opacity={0} />
          <circle cx="12" cy="13" r="2.6" />
          <path d="M12 10.4V8.8M12 17.2v-1.6" />
        </svg>
      </span>
      <span className={cn("font-display text-lg font-medium tracking-tight", light ? "text-ink-950" : "text-paper-50")}>
        Secured<span className="text-gold-400">Landing</span>
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
              className="text-[13px] font-medium tracking-wide text-paper-50/65 transition-colors hover:text-paper-50"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#invest"
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-paper-50/80 ring-1 ring-paper-50/20 transition hover:ring-paper-50/45 hover:text-paper-50"
          >
            Start Investing
          </a>
<SignedOut>
  <SignInButton mode="modal">
    <button className="rounded-full px-4 py-2 text-[13px] font-semibold ring-1 ring-paper-50/20">
      Sign In
    </button>
  </SignInButton>
</SignedOut>

<SignedIn>
  <UserButton />
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
          <div className="mt-4 flex gap-3">
            <a href="#invest" onClick={() => setOpen(false)} className="flex-1 rounded-full py-2.5 text-center text-sm font-semibold ring-1 ring-paper-50/25">
              Start Investing
            </a>
            <a href="#borrow" onClick={() => setOpen(false)} className="flex-1 rounded-full bg-gold-400 py-2.5 text-center text-sm font-semibold text-ink-950">
              Get a Loan
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
