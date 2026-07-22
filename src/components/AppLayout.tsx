import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BrandLogo from "./BrandLogo";

interface NavItem { href: string; label: string; }
const BORROWER_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/loan-application", label: "Apply" },
  { href: "/loan-forms", label: "Loan Forms" },
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
function linksByRole(role: string | null) {
  if (role === "investor") return INVESTOR_LINKS;
  if (role === "admin") return ADMIN_LINKS;
  return BORROWER_LINKS;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      try {
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (!active || !data.user) return;
        setEmail(data.user.email ?? "");
        const value = String(data.user.user_metadata?.role || data.user.app_metadata?.role || "borrower").toLowerCase();
        setRole(value || "borrower");
      } catch (error) {
        console.error("Unable to load layout user:", error);
      }
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  async function logout() {
    try { if (supabase) await supabase.auth.signOut(); } catch (error) { console.error(error); }
    navigate("/login", { replace: true });
  }

  const navLinks = linksByRole(role);
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950 text-white shadow-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogo className="h-14 w-auto max-w-[250px]" light />
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <Link key={item.href} to={item.href} className={`rounded-lg px-3 py-2 text-sm font-medium ${location.pathname === item.href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[150px] truncate text-xs text-slate-300 sm:inline">{email}</span>
            <button type="button" onClick={logout} className="hidden rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 sm:block">Sign Out</button>
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden">
              <span className="text-xl">{menuOpen ? "×" : "☰"}</span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 px-4 pb-4 pt-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => <Link key={item.href} to={item.href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10">{item.label}</Link>)}
              <button type="button" onClick={logout} className="rounded-lg px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-white/10">Sign Out</button>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} SecuredLanding</span>
          <span>Land-backed lending platform. Investments involve risk.</span>
        </div>
      </footer>
    </div>
  );
}
