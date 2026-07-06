import { useState } from "react";

export default function BitcoinPayment() {
  const [amount, setAmount] = useState("10.99");
  const [message, setMessage] = useState("");

  async function createBitcoinInvoice() {
    setMessage("Creating Bitcoin invoice...");

    try {
      const response = await fetch("/api/create-bitcoin-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });

      const data = await response.json();

      if (!response.ok || !data.checkoutLink) {
        setMessage(data.error || "Unable to create Bitcoin invoice.");
        return;
      }

      window.location.href = data.checkoutLink;
    } catch (error) {
      setMessage("Bitcoin payment setup failed.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-3xl font-bold text-orange-600">
          Bitcoin Payment
        </h1>

        <p className="mt-2 text-gray-600">
          Pay your investment amount using Bitcoin.
        </p>

        <label className="block mt-6 font-bold">Amount</label>
        <input
          type="number"
          step="0.01"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border p-3 rounded mt-2"
        />

        <button
          onClick={createBitcoinInvoice}
          className="mt-6 w-full bg-orange-500 text-white py-3 rounded-lg font-bold"
        >
          Create Bitcoin Invoice
        </button>

        <button
          onClick={() => (window.location.href = "/investor-wallet")}
          className="mt-3 w-full bg-gray-700 text-white py-3 rounded-lg font-bold"
        >
          Back to Investor Wallet
        </button>

        {message && <p className="mt-4 text-center">{message}</p>}
      </div>
    </div>
  );
}