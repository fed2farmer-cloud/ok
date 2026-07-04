import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function InvestorDashboard() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("status", "Approved");

    if (error) {
      alert(error.message);
    } else {
      setLoans(data || []);
    }

    setLoading(false);
  }

  async function invest(loan: any) {
    if (!supabase) return;

    const amount = prompt("Investment Amount");

    if (!amount) return;

    const {
  data: { session },
} = await supabase.auth.getSession();
if (!session) {
  alert("Please log in again.");
  return;
}

const { data, error } = await supabase.functions.invoke("nmi-payment", {
  body: {
    loanId: loan.Id,
    amount: Number(amount),
    paymentToken: "test",
  },
  headers: {
    Authorization: `Bearer ${session?.access_token}`,
  },
});

    if (error) {
      alert(error.message);
      return;
    }

    alert(data?.message || "Investment submitted successfully!");
    await loadLoans();
  }

  if (loading) return <h2 className="p-6">Loading...</h2>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Investor Dashboard
      </h1>

      {loans.length === 0 && <p>No approved loan applications available.</p>}

      {loans.map((loan) => (
        <div key={loan.Id} className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="text-xl font-bold">{loan.business_name}</h2>

          <p><b>Applicant:</b> {loan.full_name}</p>
          <p><b>State:</b> {loan.state}</p>
          <p><b>Land Type:</b> {loan.land_type}</p>
          <p><b>Acres:</b> {loan.acreage}</p>
          <p><b>Land Value:</b> ${Number(loan.land_value || 0).toLocaleString()}</p>
          <p><b>Loan Amount:</b> ${Number(loan.loan_amount || 0).toLocaleString()}</p>
          <p><b>Purpose:</b> {loan.purpose || loan.loan_purpose}</p>

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