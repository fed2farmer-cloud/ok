interface RepaymentScheduleProps {
  loanAmount: number;
  annualRatePercent: number;
  termMonths: number;
  startDate?: Date;
}

interface ScheduleRow {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  date: string;
}

function buildSchedule(
  loanAmount: number,
  annualRate: number,
  termMonths: number,
  startDate: Date
): ScheduleRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    monthlyRate === 0
      ? loanAmount / termMonths
      : (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  const rows: ScheduleRow[] = [];
  let balance = loanAmount;

  for (let i = 1; i <= termMonths; i++) {
    const interest = balance * monthlyRate;
    const principal = Math.min(payment - interest, balance);
    balance = Math.max(balance - principal, 0);

    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);

    rows.push({
      period: i,
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      date: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    });
  }

  return rows;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export default function RepaymentSchedule({
  loanAmount,
  annualRatePercent,
  termMonths,
  startDate = new Date(),
}: RepaymentScheduleProps) {
  if (!loanAmount || loanAmount <= 0 || !termMonths || termMonths <= 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-bold text-slate-900">Repayment Schedule</h3>
        <p className="mt-2 text-sm text-slate-500">Loan terms not yet set.</p>
      </div>
    );
  }

  const schedule = buildSchedule(loanAmount, annualRatePercent, termMonths, startDate);
  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const monthlyPayment = schedule[0]?.payment ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-900">Repayment Schedule</h3>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Monthly Payment", fmt(monthlyPayment)],
          ["Loan Amount", fmt(loanAmount)],
          ["Total Interest", fmt(totalInterest)],
          ["Total Cost", fmt(totalPayment)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-base font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Table (first 12 + last row) */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</th>
              <th className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Payment</th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Principal</th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Interest</th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Balance</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row, i) => {
              // Show first 6, "...", then last 3
              const visible = termMonths <= 12 || i < 6 || i >= termMonths - 3;
              const showEllipsis = termMonths > 12 && i === 6;

              if (!visible) return null;

              return (
                <>
                  {showEllipsis && (
                    <tr key="ellipsis" className="text-center text-slate-400">
                      <td colSpan={6} className="py-2 text-xs">
                        ··· {termMonths - 9} more payments ···
                      </td>
                    </tr>
                  )}
                  <tr key={row.period} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-500">{row.period}</td>
                    <td className="py-2 text-slate-500">{row.date}</td>
                    <td className="py-2 text-right font-semibold text-slate-800">{fmt(row.payment)}</td>
                    <td className="py-2 text-right text-slate-600">{fmt(row.principal)}</td>
                    <td className="py-2 text-right text-slate-500">{fmt(row.interest)}</td>
                    <td className="py-2 text-right text-slate-700">{fmt(row.balance)}</td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
