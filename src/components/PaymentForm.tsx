import { NmiPayments } from "@nmipayments/nmi-pay-react";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function PaymentForm() {
  const params = new URLSearchParams(window.location.search);

  const loanId = Number(params.get("loanId") || params.get("loan") || 0);
  const startingAmount = params.get("amount") || "";

  const [amount, setAmount] = useState(startingAmount);
  const [paymentStatus, setPaymentStatus] = useState("");

  const cleanAmount = Number(amount || 0).toFixed(2);

  async function saveInvestment() {
    if (!supabase) {
      alert("Supabase is not configured.");
      return false;
    }

    if (!loanId) {
      alert("No loan selected.");
      return false;
    }

    if (Number(cleanAmount) < 100) {
      alert("Minimum investment is $100.");
      return false;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      return false;
    }

    const { error: investError } = await supabase.from("investments").insert({
      investor_id: user.id,
      loan_id: loanId,
      amount: Number(cleanAmount),
      investor_interest_rate: 9,
      borrower_interest_rate: 10,
      company_spread_rate: 1,
      term_months: 36,
      status: "active",
    });

    if (investError) {
      alert("Investment save failed: " + investError.message);
      return false;
    }

    const { data: marketplaceLoan, error: loanFetchError } = await supabase
      .from("marketplace_loans")
      .select("*")
      .eq("loan_application_id", loanId)
      .single();

    if (loanFetchError || !marketplaceLoan) {
      alert("Investment saved, but marketplace loan was not found.");
      return true;
    }

    const newFunded =
      Number(marketplaceLoan.amount_funded || 0) + Number(cleanAmount);

    const fundingGoal = Number(
      marketplaceLoan.funding_goal || marketplaceLoan.loan_amount || 0
    );

    const newRemaining = Math.max(fundingGoal - newFunded, 0);
    const newStatus = newRemaining <= 0 ? "Funded" : "Open";

    const { error: updateMarketError } = await supabase
      .from("marketplace_loans")
      .update({
        amount_funded: newFunded,
        amount_remaining: newRemaining,
        status: newStatus,
      })
      .eq("loan_application_id", loanId);

    if (updateMarketError) {
      alert("Investment saved, but marketplace update failed.");
      return true;
    }

    await supabase
      .from("loan_applications")
      .update({
        amount_funded: newFunded,
        amount_remaining: newRemaining,
        status: newStatus === "Funded" ? "Funded" : "Approved",
      })
      .eq("Id", loanId);

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

      <NmiPayments
        tokenizationKey={import.meta.env.VITE_NMI_TOKENIZATION_KEY}
        paymentMethods={["card"]}
        onPay={async (token) => {
          const response = await fetch("/api/process-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentToken: token,
              amount: Number(cleanAmount),
            }),
          });

          const data = await response.json();

          if (data.success) {
            setPaymentStatus("Payment successful!");

            const saved = await saveInvestment();

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