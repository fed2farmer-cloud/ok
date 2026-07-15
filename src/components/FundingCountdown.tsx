import { useEffect, useMemo, useState } from "react";

function getRemaining(deadline?: string | null) {
  if (!deadline) return { days: 45, hours: 0, expired: false };
  const milliseconds = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return { days: 0, hours: 0, expired: true };
  return {
    days: Math.ceil(milliseconds / 86_400_000),
    hours: Math.floor((milliseconds % 86_400_000) / 3_600_000),
    expired: false,
  };
}

export default function FundingCountdown({ deadline, funded = 0, goal = 0 }: { deadline?: string | null; funded?: number; goal?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = getRemaining(deadline);
  const percent = useMemo(() => goal > 0 ? Math.min(100, Math.max(0, (funded / goal) * 100)) : 0, [funded, goal]);
  const urgency = remaining.days <= 1 ? "Final day" : remaining.days <= 10 ? `${remaining.days} days left — act soon` : `${remaining.days} days remaining`;

  return (
    <section className="rounded-2xl border border-emerald-800/40 bg-emerald-950 p-5 text-white shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">45-day funding campaign</p>
      <h3 className="mt-2 text-2xl font-black">{remaining.expired ? "Funding window closed" : urgency}</h3>
      {!remaining.expired && <p className="mt-1 text-sm text-emerald-100">Approximately {remaining.hours} additional hours beyond the displayed day count.</p>}
      <div className="mt-5 flex items-center justify-between text-sm font-bold">
        <span>{funded.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} funded</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-emerald-100">Goal: {goal.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</p>
    </section>
  );
}
