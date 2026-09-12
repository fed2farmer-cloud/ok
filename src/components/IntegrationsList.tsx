import Reveal from "./Reveal";

const workflows = [
  {
    name: "Supabase Auth",
    title: "Identity and account login",
    body: "Borrowers, investors, and admins sign in with Supabase Auth before accessing protected dashboards and workflows.",
    env: "VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY",
  },
  {
    name: "Plaid",
    title: "Bank connection and funding readiness",
    body: "Investors connect and verify bank accounts through SecuredLanding's protected Vercel API route.",
    env: "PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV",
  },
  {
    name: "ReportAll API",
    title: "Parcel, owner, and property intelligence",
    body: "Property records, parcel details, and ownership data can be requested for each land-backed deal before closing.",
    env: "REPORTALL_API_KEY",
  },
  {
    name: "Proof",
    title: "Remote online notarization",
    body: "Closing documents can be routed to Proof for eligibility, notarization, status updates, and completed-document handling.",
    env: "PROOF_API_KEY, PROOF_ENVIRONMENT",
  },
];

export default function IntegrationsList() {
  return (
    <section id="integrations" className="relative border-y border-paper-50/8 bg-ink-900/40 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-moss-400">Platform Infrastructure</p>
          <h2 className="mt-4 font-display text-3xl font-light tracking-tight text-paper-50 sm:text-5xl">
            Built for real onboarding, verification, property diligence, and closing
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-paper-50/55">
            SecuredLanding uses Supabase for identity and data, Vercel server functions for protected integrations, Plaid for bank verification, ReportAll for land data, and Proof for online notarization.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {workflows.map((w, index) => (
            <Reveal key={w.name} delay={index * 90}>
              <div className="h-full rounded-2xl bg-ink-950/75 p-6 ring-1 ring-paper-50/8 transition hover:ring-moss-400/30">
                <span className="rounded-full bg-moss-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-moss-300 ring-1 ring-moss-400/20">
                  {w.name}
                </span>
                <h3 className="mt-5 font-display text-lg font-medium text-paper-50">{w.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-paper-50/55">{w.body}</p>
                <p className="mt-5 rounded-xl bg-paper-50/5 p-3 font-mono text-[10px] leading-relaxed text-paper-50/40 ring-1 ring-paper-50/8">
                  {w.env}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
