import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoanApplication() {
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    taxIdLast4: "",
    email: "",
    phone: "",
    propertyAddress: "",
    apn: "",
    county: "",
    state: "",
    landType: "",
    acreage: "",
    landValue: "",
    loanAmount: "",
    purpose: "",
  });

  function update(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!supabase) {
      alert("Supabase is not configured.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      return;
    }

    const { error } = await supabase.from("loan_applications").insert({
      full_name: form.fullName,
      business_name: form.businessName,
      tax_id_last4: form.taxIdLast4,
      email: form.email,
      phone: form.phone,
      property_address: form.propertyAddress,
      apn: form.apn,
      county: form.county,
      state: form.state,
      land_type: form.landType,
      acreage: form.acreage === "" ? null : Number(form.acreage),
      land_value: form.landValue === "" ? null : Number(form.landValue),
      loan_amount: form.loanAmount === "" ? null : Number(form.loanAmount),
      purpose: form.purpose,
      status: "Pending",
      user_id: user.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Application submitted successfully!");

    window.location.href = "/dashboard";
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
            name="businessName"
            placeholder="Business Name / Farm Name"
            value={form.businessName}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="taxIdLast4"
            placeholder="Last 4 of SSN or EIN"
            value={form.taxIdLast4}
            onChange={update}
            maxLength={4}
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
            placeholder="Property Address (if available)"
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
            name="landType"
            value={form.landType}
            onChange={update}
            className="w-full border p-3 rounded"
          >
            <option value="">Select Land Type</option>
            <option value="Farm">Farm</option>
            <option value="Ranch">Ranch</option>
            <option value="Vacant Land">Vacant Land</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Timber">Timber</option>
            <option value="Other">Other</option>
          </select>

          <input
            name="acreage"
            type="number"
            placeholder="Acreage"
            value={form.acreage}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="landValue"
            type="number"
            placeholder="Estimated Land Value"
            value={form.landValue}
            onChange={update}
            className="w-full border p-3 rounded"
          />

          <input
            name="loanAmount"
            type="number"
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
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
          >
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}