import AppLayout from "../components/AppLayout";
import KYCWorkflow from "../components/KYCWorkflow";

export default function KYCPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-950">Identity Verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete your KYC/AML verification to unlock full platform access. Your information
            is encrypted and handled in compliance with applicable regulations.
          </p>
        </div>

        <KYCWorkflow expanded />

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-bold text-slate-900">Why we verify your identity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Bank Secrecy Act (BSA)", "Federal law requires us to verify the identity of all users."],
              ["Anti-Money Laundering (AML)", "We screen all accounts against OFAC and FinCEN watchlists."],
              ["Know Your Customer (KYC)", "Ensures investors and borrowers meet eligibility requirements."],
              ["Data Security", "Your information is encrypted at rest and in transit using AES-256."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
