import { NmiPayments } from "@nmipayments/nmi-pay-react";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function PaymentForm() {
  const [amount, setAmount] = useState("10.99");
  const [paymentStatus, setPaymentStatus] = useState("");

  const cleanAmount = Number(amount || 0).toFixed(2);

  async function saveInvestment() {
    if (!supabase) {
      alert("Supabase is not configured.");
      return false;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("No logged-in investor user found.");
      return false;
    }

    const payload = {
      investor_id: user.id,
      loan_application_id: 4,
      amount: Number(cleanAmount),
      investor_interest_rate: 9,
      borrower_interest_rate: 10,
      company_spread_rate: 1,
      term_months: 36,
      status: "active",
    };

    const { error } = await supabase.from("investments").insert(payload);

    if (error) {
      alert("Investment save failed: " + error.message);
      return false;
    }

    alert("Investment saved successfully.");
    return true;
  }

  return (
    <div>
      <div className="form-row">
        <label htmlFor="amount">Amount:</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="1.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {paymentStatus && <div>{paymentStatus}</div>}

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

          const errorMessage = data.error || "Payment failed";
          setPaymentStatus(errorMessage);
          return errorMessage;
        }}
      />

      <button
        onClick={() => (window.location.href = "/bitcoin-payment")}
        className="mt-4 w-full bg-orange-500 text-white py-3 rounded-lg font-bold"
      >
        Pay with Bitcoin
      </button>
    </div>
  );
}