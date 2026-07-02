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
    alert("Please log in.");
    return;
  }

  const { error } = await supabase
    .from("loan_applications")
    .insert([
      {
        full_name: form.fullName,
        business_name: form.businessName,
        email: form.email,
        phone: form.phone,
        tax_id_last4: form.taxIdLast4,
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
      },
    ]);

  if (error) {
    alert(error.message);
  } else {
    alert("Application submitted successfully!");
  }
}