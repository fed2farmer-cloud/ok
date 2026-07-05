import { NmiPayments } from "@nmipayments/nmi-pay-react";
import { useState } from "react";

export default function PaymentForm() {
  const [amount, setAmount] = useState("10.99");
  const [paymentStatus, setPaymentStatus] = useState("");

  const cleanAmount = Number(amount).toFixed(2);

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
            return true;
          }

          const errorMessage = data.error || "Payment failed";
          setPaymentStatus(errorMessage);
          return errorMessage;
        }}
      />
    </div>
  );
}