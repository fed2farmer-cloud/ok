import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { completeInvestmentRefund } from "../features/investorProtection/investorProtectionService";

type RefundRequest = {
  id: string;
  investment_id: string;
  investor_user_id: string;
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
      .select("id,investment_id,investor_user_id,requested_amount,reason,status,requested_at")
      .order("requested_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }
    setRequests((data ?? []) as RefundRequest[]);
  }

  useEffect(() => { void load(); }, []);

  async function complete(id: string) {
    setMessage("");
    try {
      await completeInvestmentRefund(id);
      setMessage("Refund completed and returned to the investor wallet.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refund failed.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold text-slate-900">Investment Refunds</h1>
      <p className="mt-2 text-slate-600">
        Investor-only refund requests made during the seven-day protection period.
      </p>

      {message && <p className="mt-4 rounded-xl bg-slate-100 p-3">{message}</p>}

      <div className="mt-6 space-y-4">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="font-bold">${Number(request.requested_amount).toLocaleString()}</p>
                <p className="text-sm text-slate-600">{request.reason || "No reason supplied"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(request.requested_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
                  {request.status}
                </span>
                {!["completed", "rejected", "cancelled"].includes(request.status) && (
                  <button
                    onClick={() => void complete(request.id)}
                    className="mt-3 block rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white"
                  >
                    Complete Refund
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
