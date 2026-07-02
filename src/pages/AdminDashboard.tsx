import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminDashboard() {
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setApplications(data || []);
  }

  async function updateStatus(id: number, status: string) {
    if (!supabase) return;

    const { error } = await supabase
      .from("loan_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadApplications();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Admin Dashboard
      </h1>

      {applications.map((loan) => (
        <div key={loan.id} className="bg-white rounded-xl shadow p-5 mb-4">
          <h2 className="text-xl font-bold">
            {loan.business_name || "Loan Application"}
          </h2>

          <p>{loan.full_name}</p>
          <p>{loan.email}</p>
          <p>Requested Loan: ${Number(loan.loan_amount || 0).toLocaleString()}</p>
          <p>Land Value: ${Number(loan.land_value || 0).toLocaleString()}</p>
          <p>Acres: {loan.acreage}</p>
          <p>Status: {loan.status || "Pending"}</p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => updateStatus(loan.id, "Approved")}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Approve
            </button>

            <button
              onClick={() => updateStatus(loan.id, "Denied")}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Deny
            </button>

            <button
              onClick={() => updateStatus(loan.id, "Funded")}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Funded
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}