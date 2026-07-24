export default function InvestorProtectionBadge({
  enabled = true,
  days = 7,
}: {
  enabled?: boolean;
  days?: number;
}) {
  if (!enabled || days <= 0) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
      <span aria-hidden="true">🛡️</span>
      {days}-Day Investment Protection
    </div>
  );
}
