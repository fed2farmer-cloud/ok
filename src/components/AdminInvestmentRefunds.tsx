import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RefundRequest = {
  id: string;
  requested_amount: number;
  reason: string | null;
  status: string;
  requested_at: string;
};

export default function AdminInvestmentRefunds() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("investment_refund_requests")
      .select("id,requested_amount,reason,status,requested_at")
      .order("requested_at", { ascending: false });

    if (error) return setMessage(error.message);
    setRequests((data ?? []) as RefundRequest[]);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold">Investment Refunds</h1>
      {message && <p className="mt-4">{message}</p>}
      <div className="mt-6 space-y-4">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border bg-white p-5">
            <p className="font-bold">${Number(request.requested_amount).toLocaleString()}</p>
            <p>{request.reason || "No reason supplied"}</p>
            <p className="text-sm">{request.status}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
