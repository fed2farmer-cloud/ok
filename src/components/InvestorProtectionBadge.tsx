export default function InvestorProtectionBadge({
  enabled = true,
  days = 7,
}: {
  enabled?: boolean;
  days?: number;
}) {
  if (!enabled || days <= 0) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-950 px-3 py-1.5 text-sm font-bold text-emerald-300">
      <span aria-hidden="true">🛡️</span>
      {days}-Day Investment Protection
    </div>
  );
}
