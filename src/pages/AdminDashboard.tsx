import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminDashboard() {
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
    const { data, error } = await supabase!
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setApplications(data || []);
  }

  async function updateStatus(id: number, status: string) {
    await supabase!
      .from("loan_applications")
      .update({ status })
      .eq("Id", id);

    loadApplications();
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        Admin Dashboard
      </h1>

      {applications.map((loan) => (
        <div
          key={loan.Id}
          className="bg-white rounded-xl shadow p-5 mb-4"
        >
          <h2 className="text-xl font-bold">
            {loan.business_name}
          </h2>

          <p>{loan.full_name}</p>
          <p>{loan.email}</p>
          <p>Requested Loan: ${loan.loan_amount}</p>
          <p>Land Value: ${loan.land_value}</p>
          <p>Acres: {loan.acreage}</p>

          <div className="mt-4 flex gap-2">
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
              Funded
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}