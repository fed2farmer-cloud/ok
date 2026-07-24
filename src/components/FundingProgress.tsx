type Props = {
  funded: number;
  goal: number;
  createdAt?: string | null;
  fundingDays?: number;
};

function money(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function FundingProgress({ funded, goal, createdAt, fundingDays = 45 }: Props) {
  const safeGoal = Math.max(goal, 0);
  const safeFunded = Math.max(funded, 0);
  const remaining = Math.max(safeGoal - safeFunded, 0);
  const percentage = safeGoal > 0 ? Math.min((safeFunded / safeGoal) * 100, 100) : 0;

  let daysRemaining: number | null = null;
  if (createdAt) {
    const openedAt = new Date(createdAt);
    if (!Number.isNaN(openedAt.getTime())) {
      const closesAt = openedAt.getTime() + fundingDays * 24 * 60 * 60 * 1000;
      daysRemaining = Math.max(Math.ceil((closesAt - Date.now()) / (24 * 60 * 60 * 1000)), 0);
    }
  }

  return (
    <section className="mt-7 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Funding progress</p>
          <p className="mt-1 text-2xl font-black text-white">{percentage.toFixed(0)}% funded</p>
        </div>
        {daysRemaining !== null && (
          <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-sm font-bold text-amber-200">
            {daysRemaining === 0 ? "Funding window closing" : `${daysRemaining} days remaining`}
          </span>
        )}
      </div>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-700" aria-label={`${percentage.toFixed(0)} percent funded`}>
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><span className="block text-slate-400">Funded</span><strong>{money(safeFunded)}</strong></div>
        <div className="text-center"><span className="block text-slate-400">Remaining</span><strong>{money(remaining)}</strong></div>
        <div className="text-right"><span className="block text-slate-400">Goal</span><strong>{money(safeGoal)}</strong></div>
      </div>
    </section>
  );
}
