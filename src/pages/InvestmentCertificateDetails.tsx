import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { supabase } from "../lib/supabase";

type CertificateInvestment = {
  id: number;
  loan_id: number;
  investor_id: string;
  amount: number;
  investor_interest_rate: number | null;
  term_months: number | null;
  status: string;
  created_at: string;
  certificate_number: string;
  certificate_uuid: string;
  original_investor_id: string;
  current_owner_id: string;
  transfer_count: number;
  transfer_locked: boolean;
  certificate_issued_at: string;
};

type OwnershipEvent = {
  id: number;
  from_owner_id: string | null;
  to_owner_id: string;
  transfer_type: string;
  purchase_price: number | null;
  principal_transferred: number | null;
  transfer_status: string;
  transferred_at: string;
};

const money = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const statusLabel = (value: string) =>
  String(value || "issued").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function InvestmentCertificateDetails() {
  const { certificateNumber = "" } = useParams();
  const navigate = useNavigate();
  const [investment, setInvestment] = useState<CertificateInvestment | null>(null);
  const [history, setHistory] = useState<OwnershipEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate("/login", { replace: true });
        return;
      }

      const { data, error: investmentError } = await supabase
        .from("investments")
        .select("id,loan_id,investor_id,amount,investor_interest_rate,term_months,status,created_at,certificate_number,certificate_uuid,original_investor_id,current_owner_id,transfer_count,transfer_locked,certificate_issued_at")
        .eq("certificate_number", certificateNumber)
        .maybeSingle();

      if (investmentError || !data) {
        setError(investmentError?.message || "Certificate not found.");
        setLoading(false);
        return;
      }

      if (data.investor_id !== auth.user.id && data.current_owner_id !== auth.user.id) {
        setError("You do not have permission to view this certificate.");
        setLoading(false);
        return;
      }

      setInvestment(data as CertificateInvestment);
      const { data: events, error: historyError } = await supabase
        .from("investment_ownership_history")
        .select("id,from_owner_id,to_owner_id,transfer_type,purchase_price,principal_transferred,transfer_status,transferred_at")
        .eq("investment_id", data.id)
        .order("transferred_at", { ascending: true });

      if (historyError) setError(historyError.message);
      setHistory((events || []) as OwnershipEvent[]);
      setLoading(false);
    }
    void load();
  }, [certificateNumber, navigate]);

  if (loading) {
    return <AppLayout><div className="mx-auto max-w-5xl px-4 py-16 text-center text-white">Loading certificate...</div></AppLayout>;
  }

  if (error || !investment) {
    return <AppLayout><div className="mx-auto max-w-3xl px-4 py-16"><div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-6 text-rose-200">{error || "Certificate unavailable."}</div></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="mx-auto max-w-5xl px-4 py-10 text-white print:bg-white print:text-black">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link to="/investor-wallet" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800">← Back to Wallet</Link>
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-black text-slate-950 hover:bg-amber-300">Print Certificate</button>
        </div>

        <section className="relative overflow-hidden rounded-[2rem] border border-amber-400/50 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 p-7 shadow-2xl sm:p-12 print:border-2 print:border-black print:bg-white">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl print:hidden" />
          <div className="relative text-center">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-amber-300 print:text-black">SecuredLanding</p>
            <h1 className="mt-4 text-3xl font-black sm:text-5xl">Investment Certificate</h1>
            <p className="mt-3 text-sm text-slate-300 print:text-black">Permanent record of an ownership interest in a land-backed loan</p>
          </div>

          <div className="relative mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 text-center print:border-black print:bg-white">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 print:text-black">Certificate Number</p>
            <p className="mt-2 break-all font-mono text-xl font-black text-amber-300 sm:text-3xl print:text-black">{investment.certificate_number}</p>
          </div>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Underlying Loan", `Loan #${investment.loan_id}`],
              ["Principal", money(investment.amount)],
              ["Investor Rate", `${Number(investment.investor_interest_rate || 0).toFixed(2)}%`],
              ["Term", `${investment.term_months || 0} months`],
              ["Issued", new Date(investment.certificate_issued_at).toLocaleDateString()],
              ["Status", statusLabel(investment.status)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4 print:border-black print:bg-white">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black">{label}</p>
                <p className="mt-2 text-lg font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 print:border-black print:bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black">Certificate UUID</p>
              <p className="mt-2 break-all font-mono text-xs">{investment.certificate_uuid}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 print:border-black print:bg-white">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black">Transfer Status</p>
              <p className="mt-2 font-black">{investment.transfer_locked ? "Transfers Locked" : "Registry Active"}</p>
              <p className="mt-1 text-xs text-slate-400 print:text-black">Recorded transfers: {investment.transfer_count}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-[#111] p-6 print:border-black print:bg-white">
          <h2 className="text-xl font-black">Ownership History</h2>
          <div className="mt-5 space-y-4">
            {history.length === 0 ? <p className="text-slate-400 print:text-black">No ownership events found.</p> : history.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-800 p-4 print:border-black">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{statusLabel(event.transfer_type)}</p>
                    <p className="mt-1 text-sm text-slate-400 print:text-black">{new Date(event.transferred_at).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300 print:border print:border-black print:bg-white print:text-black">{statusLabel(event.transfer_status)}</span>
                </div>
                <p className="mt-3 text-sm">Principal: <strong>{money(event.principal_transferred)}</strong></p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
