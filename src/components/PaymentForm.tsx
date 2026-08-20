import { NmiPayments } from "@nmipayments/nmi-pay-react";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { getNmiBrowserDiagnostics, getNmiTokenizationKey } from "../lib/nmi";

export default function PaymentForm() {
  const params = new URLSearchParams(window.location.search);

  const loanId = params.get("loanId") || params.get("loan") || "";
  const startingAmount = params.get("amount") || "";

  const [amount, setAmount] = useState(startingAmount);
  const [paymentStatus, setPaymentStatus] = useState("");

  const cleanAmount = Number(amount || 0).toFixed(2);
  const nmiDiagnostics = getNmiBrowserDiagnostics();

  async function saveInvestment(processorTransactionId: string) {
    if (!supabase) {
      alert("Supabase is not configured.");
      return false;
    }

    const publicLoanNumber = Number(loanId);
    const totalAmount = Number(params.get("totalAmount") || cleanAmount);
    const walletAmount = Number(params.get("walletAmount") || 0);

    if (!Number.isSafeInteger(publicLoanNumber) || publicLoanNumber <= 0) {
      alert("No valid loan selected.");
      return false;
    }
    if (!Number.isFinite(totalAmount) || totalAmount < 100) {
      alert("Minimum investment is $100.");
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please log in first.");
      return false;
    }

    // One database transaction resolves the public loan number to the canonical
    // application, records the TOTAL investment, consumes any split-wallet cash
    // (even a remainder below $100), and refreshes marketplace funding totals.
    const { error } = await supabase.rpc("finalize_external_investment_v1", {
      p_loan_number: publicLoanNumber,
      p_total_amount: totalAmount,
      p_wallet_amount: Math.max(walletAmount, 0),
      p_processor_transaction_id: processorTransactionId,
    });

    if (error) {
      alert("Payment worked, but investment finalization failed: " + error.message);
      return false;
    }

    window.sessionStorage.removeItem("securedlanding_pending_split_investment");
    return true;
  }

  return (
    <div>
      <p className="mb-2 font-bold">Funding Loan ID: {loanId}</p>

      <div className="form-row">
        <label htmlFor="amount">Amount:</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="100"
          placeholder="Enter investment amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border rounded p-3"
        />
      </div>

      {paymentStatus && <div className="mt-3">{paymentStatus}</div>}

      <div className="mt-2 mb-3 text-xs text-slate-500" data-testid="nmi-config-status">
        NMI: {nmiDiagnostics.environment} · key {nmiDiagnostics.keySource}
      </div>

      <NmiPayments
        tokenizationKey={getNmiTokenizationKey()}
        paymentMethods={["card"]}
        onPay={async (event) => {
          const paymentToken = event.token;
          setPaymentStatus("Processing card with NMI…");
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 20000);

          let response: Response;
          try {
            response = await fetch("/api/process-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentToken,
                amount: Number(cleanAmount),
              }),
              signal: controller.signal,
            });
          } catch (error) {
            window.clearTimeout(timeout);
            const timedOut = error instanceof Error && error.name === "AbortError";
            const message = timedOut
              ? "NMI took too long to respond. Check transaction history before retrying."
              : "Unable to reach the payment processor. Please try again.";
            setPaymentStatus(message);
            return message;
          } finally {
            window.clearTimeout(timeout);
          }

          const data = await response.json().catch(() => ({
            success: false,
            error: "Invalid response from payment processor",
          }));

          if (data.success) {
            const processorTransactionId = String(data.transactionId || "").trim();
            if (!processorTransactionId) {
              const message = "Processor approved the payment but did not return a transaction ID. Do not retry; contact support for reconciliation.";
              setPaymentStatus(message);
              return message;
            }

            setPaymentStatus(`Payment approved. Finalizing investment… (Txn ${processorTransactionId})`);

            const saved = await saveInvestment(processorTransactionId);

            if (!saved) {
              return "Payment worked, but investment was not saved.";
            }

            setTimeout(() => {
              window.location.href = "/investor-wallet";
            }, 1500);

            return true;
          }

          return data.error || "Payment failed";
        }}
      />

      <button
        onClick={() =>
          (window.location.href = `/bitcoin-payment?loanId=${loanId}&amount=${cleanAmount}`)
        }
        className="mt-4 w-full bg-orange-500 text-white py-3 rounded-lg font-bold"
      >
        Pay with Bitcoin
      </button>
    </div>
  );
}