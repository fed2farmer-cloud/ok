type Props = {
  amount: string;
  onAmountChange: (value: string) => void;
  annualRate: number;
  termMonths?: number | null;
  availableBalance: number;
  maxAmount: number;
};

function money(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function InvestmentCalculator({
  amount,
  onAmountChange,
  annualRate,
  termMonths = 36,
  availableBalance,
  maxAmount,
}: Props) {
  const principal = Math.max(Number(amount || 0), 0);
  const months = Math.max(Number(termMonths || 36), 1);
  const rate = Math.max(annualRate, 0) / 100;
  const estimatedInterest = principal * rate * (months / 12);
  const estimatedTotal = principal + estimatedInterest;
  const estimatedMonthly = estimatedTotal / months;
  const exceedsWallet = principal > availableBalance;
  const exceedsRemaining = principal > maxAmount;

  return (
    <section className="mt-7 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5">
      <label className="block text-lg font-bold text-white">
        Investment amount
        <input
          type="number"
          min="100"
          step="100"
          max={Math.max(maxAmount, 100)}
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="Minimum investment $100"
          className="mt-3 w-full rounded-xl border border-slate-500 bg-slate-800 p-4 text-white outline-none focus:border-emerald-500"
        />
      </label>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-900 p-3"><span className="text-xs uppercase text-slate-400">Est. interest</span><strong className="mt-1 block text-lg text-emerald-300">{money(estimatedInterest)}</strong></div>
        <div className="rounded-xl bg-slate-900 p-3"><span className="text-xs uppercase text-slate-400">Est. total return</span><strong className="mt-1 block text-lg text-emerald-300">{money(estimatedTotal)}</strong></div>
        <div className="rounded-xl bg-slate-900 p-3"><span className="text-xs uppercase text-slate-400">Avg. monthly</span><strong className="mt-1 block text-lg text-emerald-300">{money(estimatedMonthly)}</strong></div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Illustrative simple-interest estimate. Actual payment timing and returns follow final signed loan documents.</p>
      {(exceedsWallet || exceedsRemaining) && (
        <div className="mt-3 rounded-xl bg-rose-950/50 p-3 text-sm font-semibold text-rose-200">
          {exceedsWallet ? "This amount exceeds your available wallet balance. " : ""}
          {exceedsRemaining ? "This amount exceeds the loan's remaining funding need." : ""}
        </div>
      )}
    </section>
  );
}
