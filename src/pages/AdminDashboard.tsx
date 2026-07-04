import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [rates, setRates] = useState<Record<number, string>>({});

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in first.");
      window.location.href = "/login";
      return;
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !admin) {
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
    } else {
      const loans = data || [];
      setApplications(loans);

      const startingRates: Record<number, string> = {};
      loans.forEach((loan: any) => {
        startingRates[loan.Id] = String(loan.interest_rate_percent ?? 9);
      });
      setRates(startingRates);
    }

    setLoading(false);
  }

  async function updateStatus(id: number, newStatus: string) {
    if (!supabase) return;

    const { error } = await supabase
      .from("loan_applications")
      .update({ status: newStatus })
      .eq("Id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadApplications();
  }

  async function saveInterestRate(id: number) {
    if (!supabase) return;

    const rate = Number(rates[id]);

    if (Number.isNaN(rate) || rate < 0) {
      alert("Enter a valid interest rate.");
      return;
    }

    const { error } = await supabase
      .from("loan_applications")
      .update({ interest_rate_percent: rate })
      .eq("Id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Interest rate saved.");
    loadApplications();
  }

  function monthlyPayment(loanAmount: number, annualRate: number, months: number) {
    if (!loanAmount || !months) return 0;

    const monthlyRate = annualRate / 100 / 12;

    if (monthlyRate === 0) {
      return loanAmount / months;
    }

    return (
      loanAmount *
      monthlyRate /
      (1 - Math.pow(1 + monthlyRate, -months))
    );
  }

  function money(value: number) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  if (loading || !allowed) {
    return <div className="p-8 text-center text-xl">Checking admin access...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Admin Dashboard
      </h1>

      {applications.length === 0 ? (
        <p>No loan applications found.</p>
      ) : (
        applications.map((loan) => {
          const loanAmount = Number(loan.loan_amount || 0);
          const termMonths = Number(loan.repayment_term_months || 36);
          const interestRate = Number(rates[loan.Id] || loan.interest_rate_percent || 9);
          const payment = monthlyPayment(loanAmount, interestRate, termMonths);
          const totalRepayment = payment * termMonths;
          const totalInterest = totalRepayment - loanAmount;

          return (
            <div key={loan.Id} className="bg-white rounded-xl shadow-md p-6 mb-5">
              <h2 className="text-2xl font-bold">
                {loan.business_name || "No Business Name"}
              </h2>

              <p><strong>Applicant:</strong> {loan.full_name}</p>
              <p><strong>Email:</strong> {loan.email}</p>
              <p><strong>Phone:</strong> {loan.phone}</p>
              <p><strong>State:</strong> {loan.state}</p>
              <p><strong>APN:</strong> {loan.apn}</p>
              <p><strong>Property:</strong> {loan.property_address || "No address provided"}</p>
              <p><strong>Land Type:</strong> {loan.land_type}</p>
              <p><strong>Acres:</strong> {loan.acreage}</p>
              <p><strong>Land Value:</strong> {money(Number(loan.land_value || 0))}</p>
              <p><strong>Requested Loan:</strong> {money(loanAmount)}</p>
              <p><strong>Repayment Term:</strong> {termMonths} months</p>
              <p><strong>Expected Monthly Payment:</strong> {money(payment)}</p>
              <p><strong>Total Repayment:</strong> {money(totalRepayment)}</p>
              <p><strong>Total Interest:</strong> {money(totalInterest)}</p>
              <p><strong>Purpose:</strong> {loan.purpose}</p>

              <div className="mt-4">
                <label className="font-bold block mb-1">
                  Admin Interest Rate %
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={rates[loan.Id] ?? ""}
                  onChange={(e) =>
                    setRates({ ...rates, [loan.Id]: e.target.value })
                  }
                  className="border p-3 rounded w-full max-w-xs"
                />

                <button
                  onClick={() => saveInterestRate(loan.Id)}
                  className="ml-0 sm:ml-3 mt-3 sm:mt-0 bg-purple-600 text-white px-4 py-3 rounded"
                >
                  Save Interest Rate
                </button>
              </div>

              <p className="mt-4">
                <strong>Status:</strong>{" "}
                <span className="font-bold text-green-700">
                  {loan.status || "Pending"}
                </span>
              </p>

              <div className="flex flex-wrap gap-3 mt-5">
                <button onClick={() => updateStatus(loan.Id, "Pending")} className="bg-yellow-500 text-white px-4 py-2 rounded">
                  Pending
                </button>

                <button onClick={() => updateStatus(loan.Id, "Approved")} className="bg-green-600 text-white px-4 py-2 rounded">
                  Approve
                </button>

                <button onClick={() => updateStatus(loan.Id, "Denied")} className="bg-red-600 text-white px-4 py-2 rounded">
                  Deny
                </button>

                <button onClick={() => updateStatus(loan.Id, "Funded")} className="bg-blue-600 text-white px-4 py-2 rounded">
                  Funded
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}