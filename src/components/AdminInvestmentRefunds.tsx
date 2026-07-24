import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RefundRequest = {
  id: string;
  investment_id: number;
  investor_id: string;
  loan_id: number;
  amount: number;
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
      .select("id,investment_id,investor_id,loan_id,amount,reason,status,requested_at")
      .order("requested_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setRequests((data ?? []) as RefundRequest[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function completeRefund(requestId: string) {
    setMessage("");

    const { error } = await supabase.rpc(
      "complete_investment_refund_v28",
      {
        p_refund_request_id: requestId,
        p_admin_notes: null,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Refund completed and principal returned to available cash.");
    await load();
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold">Investment Refunds</h1>

      {message && <p className="mt-4 rounded-xl bg-slate-100 p-3">{message}</p>}

      <div className="mt-6 space-y-4">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xl font-bold">
              ${Number(request.amount).toLocaleString()}
            </p>
            <p className="text-sm text-slate-600">
              Loan ID: {request.loan_id}
            </p>
            <p className="mt-2">{request.reason || "No reason supplied"}</p>
            <p className="mt-2 capitalize">{request.status}</p>

            {!["completed", "rejected", "cancelled"].includes(request.status) && (
              <button
                type="button"
                onClick={() => void completeRefund(request.id)}
                className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white"
              >
                Complete Wallet Refund
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
