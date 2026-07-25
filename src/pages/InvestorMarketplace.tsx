<div className="mt-5 space-y-3">
  <button
    type="button"
    disabled={
      investmentAmount < 100 ||
      investmentAmount > remaining ||
      investmentAmount > availableBalance ||
      isProcessing
    }
    onClick={() =>
      void handleInvestFromWallet(
        loan,
        investmentAmount,
        remaining
      )
    }
    className="w-full rounded-xl bg-emerald-600 py-4 text-xl font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-600"
  >
    {isProcessing
      ? "Processing Wallet Investment..."
      : "Invest From Wallet"}
  </button>

  {investmentAmount > availableBalance && (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 text-sm font-semibold text-amber-200">
      Your wallet has {money(availableBalance)} available. Choose another
      payment method for {money(investmentAmount)}.
    </div>
  )}

  <button
    type="button"
    disabled={
      !Number.isFinite(investmentAmount) ||
      investmentAmount < 100 ||
      investmentAmount > remaining
    }
    onClick={() =>
      navigate(
        `/payment?loanId=${
          loan.loan_number ?? loan.loan_application_id
        }&amount=${investmentAmount}&method=card`
      )
    }
    className="w-full rounded-xl bg-blue-700 py-4 text-xl font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-600"
  >
    Pay by Debit/Credit Card
  </button>

  <button
    type="button"
    disabled={
      !Number.isFinite(investmentAmount) ||
      investmentAmount < 100 ||
      investmentAmount > remaining
    }
    onClick={() =>
      navigate(
        `/bitcoin-payment?loanId=${
          loan.loan_number ?? loan.loan_application_id
        }&amount=${investmentAmount}`
      )
    }
    className="w-full rounded-xl bg-orange-500 py-4 text-xl font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-600"
  >
    Pay with Bitcoin
  </button>
</div>