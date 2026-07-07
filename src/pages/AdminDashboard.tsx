import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [editing, setEditing] = useState<Record<number, any>>({});

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!admin) {
      alert("Access denied.");
      window.location.href = "/dashboard";
      return;
    }

    setAllowed(true);
    loadApplications();
  }

  async function loadApplications() {
    if (!supabase) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const loans = data || [];
    setApplications(loans);

    const formData: Record<number, any> = {};
    loans.forEach((loan: any) => {
      formData[loan.Id] = {
        borrower_interest_rate: loan.borrower_interest_rate ?? 10,
        investor_interest_rate: loan.investor_interest_rate ?? 9,
        company_spread_rate: loan.company_spread_rate ?? 1,
        risk_score: loan.risk_score ?? "Pending",
        underwriter_notes: loan.underwriter_notes ?? "",
        published_to_marketplace: loan.published_to_marketplace ?? false,
      };
    });

    setEditing(formData);
    setLoading(false);
  }

  function money(value: number) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function monthlyPayment(amount: number, annualRate: number, months: number) {
    if (!amount || !months) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return amount / months;
    return amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  }

  function updateEdit(id: number, field: string, value: any) {
    setEditing({
      ...editing,
      [id]: {
        ...editing[id],
        [field]: value,
      },
    });
  }

  async function saveLoanTerms(id: number) {
    if (!supabase) return;

    const loan = applications.find((item) => item.Id === id);
    const values = editing[id];

    if (!loan || !values) {
      alert("Loan data not found.");
      return;
    }

    const borrowerRate = Number(values.borrower_interest_rate || 10);
    const investorRate = Number(values.investor_interest_rate || 9);
    const spreadRate = Number((borrowerRate - investorRate).toFixed(2));
    const loanAmount = Number(loan.loan_amount || 0);
    const amountFunded = Number(loan.amount_funded || 0);
    const amountRemaining = Math.max(loanAmount - amountFunded, 0);

    const { error: loanError } = await supabase
      .from("loan_applications")
      .update({
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        company_spread_rate: spreadRate,
        amount_funded: amountFunded,
        amount_remaining: amountRemaining,
        risk_score: values.risk_score,
        underwriter_notes: values.underwriter_notes,
        published_to_marketplace: values.published_to_marketplace,
      })
      .eq("Id", id);

    if (loanError) {
      alert(loanError.message);
      return;
    }

    if (values.published_to_marketplace) {
      const marketplacePayload = {
        loan_application_id: id,
        business_name: loan.business_name || "No Business Name",
        borrower_name: loan.full_name || "",
        apn: loan.apn || "",
        state: loan.state || "",
        acreage: Number(loan.acreage || 0),
        land_value: Number(loan.land_value || 0),
        loan_amount: loanAmount,
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        company_spread_rate: spreadRate,
        repayment_term_months: Number(loan.repayment_term_months || 36),
        risk_score: values.risk_score,
        funding_goal: loanAmount,
        amount_funded: amountFunded,
        amount_remaining: amountRemaining,
        status: amountRemaining <= 0 ? "Funded" : "Open",
      };

      const { error: marketError } = await supabase
        .from("marketplace_loans")
        .upsert(marketplacePayload, {
          onConflict: "loan_application_id",
        });

      if (marketError) {
        alert("Loan saved, but marketplace publish failed: " + marketError.message);
        return;
      }
    }

    alert("Loan review saved.");
    loadApplications();
  }

  async function updateStatus(id: number, status: string) {
    if (!supabase) return;

    const { error } = await supabase
      .from("loan_applications")
      .update({ status })
      .eq("Id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadApplications();
  }

  if (loading || !allowed) {
    return <div className="p-8 text-xl">Checking admin access...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Admin Loan Review Center
      </h1>

      {applications.length === 0 ? (
        <p>No loan applications found.</p>
      ) : (
        applications.map((loan) => {
          const loanAmount = Number(loan.loan_amount || 0);
          const landValue = Number(loan.land_value || 0);
          const term = Number(loan.repayment_term_months || 36);
          const borrowerRate = Number(editing[loan.Id]?.borrower_interest_rate || 10);
          const investorRate = Number(editing[loan.Id]?.investor_interest_rate || 9);
          const spread = borrowerRate - investorRate;
          const payment = monthlyPayment(loanAmount, borrowerRate, term);
          const totalRepayment = payment * term;
          const totalInterest = totalRepayment - loanAmount;
          const ltv = landValue ? (loanAmount / landValue) * 100 : 0;

          return (
            <div key={loan.Id} className="bg-white rounded-xl shadow p-6 mb-6">
              <h2 className="text-2xl font-bold text-green-700">
                {loan.business_name || "No Business Name"}
              </h2>

              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-lg">Borrower</h3>
                  <p><strong>Name:</strong> {loan.full_name}</p>
                  <p><strong>Email:</strong> {loan.email}</p>
                  <p><strong>Phone:</strong> {loan.phone}</p>
                  <p><strong>Status:</strong> {loan.status || "Pending"}</p>
                </div>

                <div>
                  <h3 className="font-bold text-lg">Property</h3>
                  <p><strong>APN:</strong> {loan.apn}</p>
                  <p><strong>Address:</strong> {loan.property_address || "Not provided"}</p>
                  <p><strong>State:</strong> {loan.state}</p>
                  <p><strong>Acres:</strong> {loan.acreage}</p>
                  <p><strong>Land Value:</strong> {money(landValue)}</p>
                  <p><strong>LTV:</strong> {ltv.toFixed(2)}%</p>
                </div>
              </div>

              <div className="mt-5 bg-gray-50 border rounded p-4">
                <h3 className="font-bold text-lg mb-2">Loan Terms</h3>
                <p><strong>Requested Loan:</strong> {money(loanAmount)}</p>
                <p><strong>Term:</strong> {term} months</p>
                <p><strong>Monthly Borrower Payment:</strong> {money(payment)}</p>
                <p><strong>Total Repayment:</strong> {money(totalRepayment)}</p>
                <p><strong>Total Interest:</strong> {money(totalInterest)}</p>
                <p><strong>Company Spread:</strong> {spread.toFixed(2)}%</p>
              </div>

              <div className="mt-5 grid md:grid-cols-3 gap-4">
                <label>
                  <span className="font-bold">Borrower Rate %</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editing[loan.Id]?.borrower_interest_rate ?? ""}
                    onChange={(e) =>
                      updateEdit(loan.Id, "borrower_interest_rate", e.target.value)
                    }
                    className="w-full border p-3 rounded mt-1"
                  />
                </label>

                <label>
                  <span className="font-bold">Investor Rate %</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editing[loan.Id]?.investor_interest_rate ?? ""}
                    onChange={(e) =>
                      updateEdit(loan.Id, "investor_interest_rate", e.target.value)
                    }
                    className="w-full border p-3 rounded mt-1"
                  />
                </label>

                <label>
                  <span className="font-bold">Risk Score</span>
                  <select
                    value={editing[loan.Id]?.risk_score ?? "Pending"}
                    onChange={(e) =>
                      updateEdit(loan.Id, "risk_score", e.target.value)
                    }
                    className="w-full border p-3 rounded mt-1"
                  >
                    <option>Pending</option>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
              </div>

              <label className="block mt-4">
                <span className="font-bold">Underwriter Notes</span>
                <textarea
                  value={editing[loan.Id]?.underwriter_notes ?? ""}
                  onChange={(e) =>
                    updateEdit(loan.Id, "underwriter_notes", e.target.value)
                  }
                  className="w-full border p-3 rounded mt-1"
                  rows={4}
                />
              </label>

              <label className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={!!editing[loan.Id]?.published_to_marketplace}
                  onChange={(e) =>
                    updateEdit(loan.Id, "published_to_marketplace", e.target.checked)
                  }
                />
                <span className="font-bold">Publish to Marketplace</span>
              </label>

              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={() => saveLoanTerms(loan.Id)}
                  className="bg-purple-600 text-white px-4 py-2 rounded"
                >
                  Save Review
                </button>

                <button
                  onClick={() => updateStatus(loan.Id, "Pending")}
                  className="bg-yellow-500 text-white px-4 py-2 rounded"
                >
                  Pending
                </button>

                <button
                  onClick={() => updateStatus(loan.Id, "Approved")}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  Approve
                </button>

                <button
                  onClick={() => updateStatus(loan.Id, "Denied")}
                  className="bg-red-600 text-white px-4 py-2 rounded"
                >
                  Deny
                </button>

                <button
                  onClick={() => updateStatus(loan.Id, "Funded")}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Mark Funded
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}