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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
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
      alert("Please login first.");
      return;
    }

    const { error } = await supabase.from("loan_applications").insert({
      full_name: form.fullName,
      business_name: form.businessName,
      tax_id_last4: form.taxIdLast4,
      email: form.email,
      phone: form.phone,
      apn: form.apn,
      property_address: form.propertyAddress,
      state: form.state,
      land_type: form.landType,
      acreage: Number(form.acreage),
      land_value: Number(form.landValue),
      loan_amount: Number(form.loanAmount),
      purpose: form.purpose,
      status: "Pending",
      user_id: user.id,
    });

    if (error) {
      alert