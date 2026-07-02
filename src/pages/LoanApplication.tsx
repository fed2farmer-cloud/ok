import { useState } from "react";

export default function LoanApplication() {
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    propertyAddress: "",
    apn: "",
    county: "",
    state: "",
    landUse: "",
    acreage: "",
    landValue: "",
    loanAmount: "",
    purpose: "",
  });

  function update(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
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
          Enter an APN / parcel number when the land has no street address.
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
            name="businessName"
            placeholder="Business Name / Farm Name"
            value={form.businessName}
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
            placeholder="Property Address, if available"
            value={form.propertyAddress}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="apn"
            placeholder="APN / Parcel Number"
            value={form.apn}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="county"
            placeholder="County"
            value={form.county}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="state"
            placeholder="State"
            value={form.state}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <select
            name="landUse"
            value={form.landUse}
            onChange={update}
            className="w-full border p-3 rounded"
          >
            <option value="">Select Land Use</option>
            <option value="farm">Farm</option>
            <option value="ranch">Ranch</option>
            <option value="vacant_land">Vacant Land</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="timber">Timber</option>
            <option value="other">Other</option>
          </select>

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