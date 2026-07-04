import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function InvestorDashboard() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    // Query all loan applications with status = 'Approved' (exact match)
    const { data, error: queryError } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("status", "Approved")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Query error:", queryError);
      setError(queryError.message);
    } else {
      console.log("Approved loans loaded:", data);
      setLoans(data || []);
    }

    setLoading(false);
  }

  async function invest(loan: any) {
    if (!supabase) return;

    const amount = prompt("Investment Amount ($)");

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
      alert("Investment error: " + error.message);
      return;
    }

    alert(data?.message || "Investment submitted successfully!");
    await loadLoans();
  }

  if (loading) return <h2 className="p-6 text-center text-xl">Loading approved loans...</h2>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-2">
        Investor Dashboard
      </h1>
      <p className="text-gray-600 mb-6">Browse and fund available loan opportunities</p>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {loans.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 text-lg">No approved loan applications available at this time.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          <p className="text-gray-700 font-semibold mb-2">
            {loans.length} {loans.length === 1 ? "opportunity" : "opportunities"} available to invest
          </p>

          {loans.map((loan) => (
            <div key={loan.Id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border-l-4 border-green-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {loan.business_name || "Business"}
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    <b>Borrower:</b> {loan.full_name || "N/A"}
                  </p>

                  <div className="space-y-2 text-sm">
                    <p>
                      <b>Requested Loan:</b> ${Number(loan.loan_amount || 0).toLocaleString()}
                    </p>
                    <p>
                      <b>Land Value:</b> ${Number(loan.land_value || 0).toLocaleString()}
                    </p>
                    <p>
                      <b>Acres:</b> {loan.acreage || "N/A"}
                    </p>
                    <p>
                      <b>State:</b> {loan.state || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Loan Purpose
                      </p>
                      <p className="text-gray-800">
                        {loan.purpose || loan.loan_purpose || "General agricultural financing"}
                      </p>
                    </div>

                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-xs font-semibold text-green-700 uppercase">Status</p>
                      <p className="text-green-700 font-bold">{loan.status || "Approved"}</p>
                    </div>

                    <button
                      onClick={() => invest(loan)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition mt-4"
                    >
                      Fund Investment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
