const items = [
  "Recorded First-Position Liens",
  "Max 50% Loan-to-Value",
  "Independent Appraisals",
  "Title-Verified Collateral",
  "48–72 Hour Approvals",
  "Monthly Investor Distributions",
  "Nationwide Coverage",
  "KYC / AML Compliant",
];

export default function Marquee() {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-paper-50/8 bg-ink-900/60 py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-ink-950 to-transparent" />
      <div className="flex w-max animate-marquee items-center gap-10">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-[12px] font-medium uppercase tracking-[0.22em] text-paper-50/40">{item}</span>
            <svg viewBox="0 0 12 12" className="h-2 w-2 text-gold-500/60" fill="currentColor">
              <path d="M6 0l1.6 4.4L12 6 7.6 7.6 6 12 4.4 7.6 0 6l4.4-1.6z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
