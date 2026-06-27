import { useState } from "react";

export default function Calculator() {
  const [value, setValue] = useState(100000);
  const ltv = 0.5;

  const loanAmount = value * ltv;

  return (
    <section
      id="calculator"
      className="py-20 bg-gray-50"
    >
      <div className="max-w-4xl mx-auto px-6">

        <h2 className="text-5xl font-bold text-center mb-4">
          Land Loan Calculator
        </h2>

        <p className="text-center text-gray-600 mb-10">
          Estimate how much you can borrow using your land as collateral.
        </p>

        <div className="bg-white rounded-xl shadow-xl p-8">

          <label className="block font-semibold mb-2">
            Estimated Land Value ($)
          </label>

          <input
            type="number"
            value={value}
            onChange={(e) =>
              setValue(Number(e.target.value))
            }
            className="w-full border rounded-lg p-3 mb-8"
          />

          <div className="bg-green-50 rounded-xl p-6 text-center">

            <p className="text-gray-600">
              Maximum Loan (50% LTV)
            </p>

            <h3 className="text-5xl font-bold text-green-700 mt-3">
              ${loanAmount.toLocaleString()}
            </h3>

          </div>

        </div>

      </div>
    </section>
  );
}