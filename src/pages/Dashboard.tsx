import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type LoanApplication = {
  Id: number;
  created_at: string;
  business_name: string | null;
  full_name: string | null;
  state: string | null;
  land_type: string | null;
  acreage: number | null;
  land_value: number | null;
  loan_amount: number | null;
  status: string | null;
  repayment_term_months: number | null;
  interest_rate_percent: number | null;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [applications, setApplications] = useState<LoanApplication[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setApplications(data);
      }
    }

    loadDashboard();
  }, []);

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function money(value: number | null) {
    if (!value) return "$0";
    return "$" + Number(value).toLocaleString();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-700">
            Borrower Dashboard
          </h1>
          <p className="mt-2 text-gray-600">Welcome {email}</p>
        </div>

        <button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold"
        >
          Logout
        </button>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold">Apply for a Land Loan</h2>
        <p className="mt-2 text-gray-600">
          Start a new land-backed loan application.
        </p>

        <button
          onClick={() => (window.location.href = "/loan-application")}
          className="mt-4 bg-green-600 text-white px-6 py-3 rounded-lg"
        >
          New Application
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold">My Applications</h2>

        {applications.length === 0 ? (
          <div className="mt-4 bg-white rounded-xl shadow p-6">
            No applications yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {applications.map((app) => (
              <div key={app.Id} className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between gap-4">
                  <h3 className="text-xl font-bold">
                    {app.business_name || app.full_name || "Loan Application"}
                  </h3>

                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">
                    {app.status || "Pending"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-gray-700">
                  <p>Requested Loan: {money(app.loan_amount)}</p>
<p>Repayment Term: {app.repayment_term_months || 36} months</p>
<p>Interest Rate: {app.interest_rate_percent || 9}%</p>
                  <p>Land Value: {money(app.land_value)}</p>
                  <p>Land Type: {app.land_type || "Not provided"}</p>
                  <p>Acres: {app.acreage || "Not provided"}</p>
                  <p>State: {app.state || "Not provided"}</p>
                  <p>
                    Submitted:{" "}
                    {app.created_at
                      ? new Date(app.created_at).toLocaleDateString()
                      : "Unknown"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}