import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function InvestorDashboard() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [investingLoanId, setInvestingLoanId] = useState<number | null>(null);
  const navigate = useNavigate();

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

    try {
      // Query approved loans with specific columns
      // Capital I in Id - this is the primary key
      const { data, error: queryError } = await supabase
        .from("loan_applications")
        .select(
          "Id, created_at, full_name, email, phone, state, apn, property_address, land_type, acreage, land_value, loan_amount, purpose, status"
        )
        .eq("status", "Approved")
        .order("created_at", { ascending: false });

      console.log("Query error:", queryError);
      console.log("Query response:", data);
      console.log("Records returned:", data?.length || 0);

      if (queryError) {
        console.error("❌ Query error:", queryError);
        setError(
          `Query Error: ${queryError.message} (Code: ${queryError.code})`
        );
      } else {
        console.log("✅ Successfully loaded", data?.length || 0, "approved loans");
        setLoans(data || []);
      }
    } catch (err: any) {
      console.error("Exception:", err);
      setError(`Exception: ${err.message}`);
    }

    setLoading(false);
  }

  async function invest(loan: any) {
    if (!supabase) {
      alert("Supabase is not configured.");
      return;
    }

    // Check if user is logged in
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Please log in to invest.");
      navigate("/login");
      return;
    }

    // Get investment amount from user
    const amount = prompt("Investment Amount ($)");
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid investment amount.");
      return;
    }

    // Set the loan being invested in
    setInvestingLoanId(loan.Id);

    // Navigate to NMI payment page with loan details
    // The payment page will handle token generation and API call
    navigate("/payment", {
      state: {
        loanApplicationId: loan.Id,
        amount: Number(amount),
        borrowerName: loan.full_name,
        propertyAddress: loan.property_address,
      },
    });
  }

  if (loading)
    return (
      <h2 className="p-6 text-center text-xl">Loading approved loans...</h2>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-2">
        Investor Dashboard
      </h1>
      <p className="text-gray-600 mb-6">
        Browse and fund available loan opportunities
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {loans.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 text-lg">
            No approved loan applications available at this time.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Check back soon for investment opportunities.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          <p className="text-gray-700 font-semibold mb-2">
            {loans.length} {loans.length === 1 ? "opportunity" : "opportunities"}{" "}
            available to invest
          </p>

          {loans.map((loan) => (
            <div
              key={loan.Id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 border-l-4 border-green-600"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {loan.property_address || "Property"}
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    <b>Borrower:</b> {loan.full_name || "N/A"}
                  </p>

                  <div className="space-y-2 text-sm">
                    <p>
                      <b>Requested Loan:</b> $
                      {Number(loan.loan_amount || 0).toLocaleString()}
                    </p>
                    <p>
                      <b>Land Value:</b> $
                      {Number(loan.land_value || 0).toLocaleString()}
                    </p>
                    <p>
                      <b>Acres:</b> {loan.acreage || "N/A"}
                    </p>
                    <p>
                      <b>State:</b> {loan.state || "N/A"}
                    </p>
                    <p>
                      <b>Land Type:</b> {loan.land_type || "N/A"}
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
                        {loan.purpose || "General agricultural financing"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Contact
                      </p>
                      <p className="text-sm text-gray-700">
                        {loan.email || "N/A"}
                      </p>
                      <p className="text-sm text-gray-700">
                        {loan.phone || "N/A"}
                      </p>
                    </div>

                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-xs font-semibold text-green-700 uppercase">
                        Status
                      </p>
                      <p className="text-green-700 font-bold">
                        {loan.status || "Approved"}
                      </p>
                    </div>

                    <button
                      onClick={() => invest(loan)}
                      disabled={investingLoanId === loan.Id}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition mt-4 disabled:opacity-50"
                    >
                      {investingLoanId === loan.Id
                        ? "Processing..."
                        : "Fund Investment"}
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
