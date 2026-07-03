import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function InvestorDashboard() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    const { data, error } = await supabase
      ?.from("loan_applications")
      .select("*")
      .eq("status", "Approved");

    if (!error && data) {
      setLoans(data);
    }

    setLoading(false);
  }

  async function invest(loan: any) {
    const amount = prompt("Investment Amount");

    if (!amount) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in.");
      return;
    }

    const { error } = await supabase.from("investments").insert({
      loan_id: loan.id,
      investor_id: user.id,
      amount: Number(amount),
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Investment submitted successfully!");
    }
  }

  if (loading) return <h2>Loading...</h2>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Investor Dashboard
      </h1>

      {loans.length === 0 && (
        <p>No approved loan applications available.</p>
      )}

      {loans.map((loan) => (
        <div
          key={loan.id}
          className="bg-white rounded-lg shadow p-5 mb-6"
        >
          <h2 className="text-xl font-bold">
            {loan.business_name}
          </h2>

          <p><b>Applicant:</b> {loan.full_name}</p>
          <p><b>State:</b> {loan.state}</p>
          <p><b>Land Type:</b> {loan.land_type}</p>
          <p><b>Acres:</b> {loan.acres}</p>
          <p><b>Land Value:</b> ${loan.land_value}</p>
          <p><b>Loan Amount:</b> ${loan.loan_amount}</p>
          <p><b>Purpose:</b> {loan.loan_purpose}</p>

          <div className="mt-4">
            <button
              onClick={() => invest(loan)}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Invest
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}