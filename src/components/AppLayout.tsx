import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Logo } from "./Nav";
import NotificationBell from "./NotificationBell";

interface NavItem {
  href: string;
  label: string;
  roles?: string[];
}

const BORROWER_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/loan-application", label: "Apply" },
  { href: "/loan-documents", label: "Documents" },
  { href: "/messages", label: "Messages" },
];

const INVESTOR_LINKS: NavItem[] = [
  { href: "/investor", label: "Portfolio" },
  { href: "/investor-wallet", label: "Wallet" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/messages", label: "Messages" },
];

const ADMIN_LINKS: NavItem[] = [
  { href: "/admin", label: "Operations" },
  { href: "/messages", label: "Messages" },
];

function linksByRole(role: string | null): NavItem[] {
  if (role === "investor") return INVESTOR_LINKS;
  if (role === "admin") return ADMIN_LINKS;
  return BORROWER_LINKS;
}

function RoleChip({ role }: { role: string | null }) {
  if (!role) return null;
  const colors: Record<string, string> = {
    borrower: "bg-emerald-500/20 text-emerald-300",
    investor: "bg-blue-500/20 text-blue-300",
    admin: "bg-amber-500/20 text-amber-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[role] ?? "bg-slate-500/20 text-slate-300"}`}
    >
      {role}
    </span>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");
      const r =
        String(user.user_metadata?.role || user.app_metadata?.role || "")
          .toLowerCase() || null;
      setRole(r || "borrower");
    });
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate("/");
  }

  const navLinks = linksByRole(role);
  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── App Header ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950 text-white shadow-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Logo dark />

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: notifications + profile */}
          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <span className="hidden max-w-[120px] truncate sm:inline">{email}</span>
                <RoleChip role={role} />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="truncate text-xs text-slate-400">{email}</p>
                    <RoleChip role={role} />
                  </div>
                  <div className="py-1">
                    <Link
                      to="/kyc"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                    >
                      Identity Verification
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="block w-full px-4 py-2.5 text-left text-sm text-rose-400 transition hover:bg-white/5"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 md:hidden"
            >
              {menuOpen ? (
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
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="border-t border-white/10 bg-slate-950 px-4 pb-5 pt-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-2 border-white/10" />
              <Link
                to="/kyc"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Identity Verification
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-2.5 text-left text-sm text-rose-400"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Page content ───────────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── App Footer ─────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/Logo.png" alt="SecuredLanding" className="h-7 w-7 object-contain" />
              <span className="text-sm font-semibold text-slate-700">SecuredLanding</span>
            </div>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} SecuredLanding. Land-backed lending
              platform. All investments involve risk.
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-medium text-emerald-700">
              <a href="/terms" className="hover:underline">Terms</a>
              <a href="/privacy" className="hover:underline">Privacy</a>
              <a href="/contact" className="hover:underline">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
