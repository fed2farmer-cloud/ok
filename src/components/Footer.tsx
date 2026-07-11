import { useState } from "react";
import Reveal from "./Reveal";
import { Logo } from "./Nav";

const CTA_IMG =
  "https://images.pexels.com/photos/33786604/pexels-photo-33786604.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1920";

function CTA() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"borrower" | "investor">("borrower");
  const [sent, setSent] = useState(false);

  return (
    <section id="cta" className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={CTA_IMG} alt="Farmland at sunset" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink-950/82" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-transparent to-ink-950" />
      </div>

      <div className="mx-auto max-w-3xl px-5 py-28 text-center lg:py-36">
        <Reveal>
          <h2 className="font-display text-4xl font-light leading-tight tracking-tight text-paper-50 sm:text-6xl">
            The ground you own is <span className="font-medium italic text-gold-300">working capital.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-paper-50/65">
            Join the waitlist for early access — whether you're unlocking equity in your land
            or putting capital to work behind a recorded lien.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <div className="mx-auto mt-10 max-w-md">
            <div className="mb-4 inline-flex rounded-full bg-ink-950/70 p-1 ring-1 ring-paper-50/15 backdrop-blur-sm">
              {(["borrower", "investor"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={
                    role === r
                      ? "rounded-full bg-paper-50 px-5 py-2 text-[12px] font-semibold capitalize text-ink-950"
                      : "rounded-full px-5 py-2 text-[12px] font-medium capitalize text-paper-50/60"
                  }
                >
                  I'm a {r}
                </button>
              ))}
            </div>

            {sent ? (
              <div className="rounded-2xl bg-moss-500/15 px-6 py-5 ring-1 ring-moss-400/30">
                <p className="text-sm font-semibold text-moss-300">
                  You're on the list. We'll reach out as {role} onboarding opens.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!email.includes("@")) return;
                  setSent(true);
                  alert("Thanks! We'll contact you soon.");
                }}
                className="flex gap-2 rounded-full bg-ink-950/80 p-1.5 ring-1 ring-paper-50/15 backdrop-blur-sm"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 bg-transparent px-4 text-sm text-paper-50 placeholder:text-paper-50/35 focus:outline-none"
                />
                <button type="submit" className="shrink-0 rounded-full bg-gold-400 px-6 py-3 text-[13px] font-semibold text-ink-950 transition hover:bg-gold-300">
                  Request Access
                </button>
              </form>
            )}
            <p className="mt-4 text-[11px] text-paper-50/35">
              $250 referral bonus for funded borrower referrals · Reduced fees for investor referrals
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const cols = [
  {
    h: "Platform",
    links: ["How It Works", "Loan Marketplace", "Borrower Portal", "Investor Dashboard", "Rates & Terms"],
  },
  {
    h: "Company",
    links: ["About", "Careers", "Partners", "Press", "Contact"],
  },
  {
    h: "Resources",
    links: ["Land Equity Guide", "Investor Education", "Referral Program", "Help Center", "Blog"],
  },
  {
    h: "Legal",
    links: ["Terms of Service", "Privacy Policy", "Lending Disclosures", "Licenses", "Fair Lending"],
  },
];

export default function Footer() {
  return (
    <>
      <CTA />
      <footer className="border-t border-paper-50/8 bg-ink-950">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <Logo />
              <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-paper-50/45">
                The land-backed lending marketplace. Unlocking the equity trapped in American
                land ownership — securely, transparently, and fast.
              </p>
              <div className="mt-6 flex gap-3">
                {["X", "in", "f", "▶"].map((s) => (
                  <a key={s} href="#top" aria-label="Social link" className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold text-paper-50/55 ring-1 ring-paper-50/15 transition hover:text-paper-50 hover:ring-paper-50/40">
                    {s}
                  </a>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {cols.map((c) => (
                <div key={c.h}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-50/40">{c.h}</h4>
                  <ul className="mt-4 space-y-2.5">
                    {c.links.map((l) => (
                      <li key={l}>
                        <a href="#top" className="text-[13px] text-paper-50/60 transition hover:text-paper-50">{l}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 border-t border-paper-50/8 pt-8">
            <p className="text-[11px] leading-relaxed text-paper-50/30">
              © {new Date().getFullYear()} SecuredLanding.com. All rights reserved. SecuredLanding is a financial
              technology platform, not a bank. Loans are subject to underwriting, title verification, independent
              valuation, and applicable state law, and are available only where legally permitted. Investments
              involve risk, including possible loss of principal, and are offered only to eligible investors in
              compliance with SEC regulations, state lending laws, AML/KYC, and consumer financial protection
              requirements. Past or projected performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
