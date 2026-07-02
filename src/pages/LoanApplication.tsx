import { useState } from "react";

export default function LoanApplication() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    propertyAddress: "",
    acreage: "",
    landValue: "",
    loanAmount: "",
    purpose: "",
  });

  function update(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    alert("Loan application submitted successfully!");
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-3xl font-bold text-green-700">
          Land Loan Application
        </h1>

        <p className="mt-2 text-gray-600">
          Complete the application below.
        </p>

        <form onSubmit={submit} className="space-y-4 mt-8">

          <input
            name="fullName"
            placeholder="Full Name"
            value={form.fullName}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="phone"
            placeholder="Phone Number"
            value={form.phone}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="propertyAddress"
            placeholder="Property Address"
            value={form.propertyAddress}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="acreage"
            placeholder="Acres"
            value={form.acreage}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="landValue"
            placeholder="Estimated Land Value"
            value={form.landValue}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="loanAmount"
            placeholder="Requested Loan Amount"
            value={form.loanAmount}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <textarea
            name="purpose"
            placeholder="Purpose of Loan"
            value={form.purpose}
            onChange={update}
            className="w-full border p-3 rounded h-32"
          />

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold"
          >
            Submit Application
          </button>

        </form>

      </div>
    </div>
  );
}