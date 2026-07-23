import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { resolveStorageUrl, resolveStorageUrls } from "../lib/mediaStorage";
import AppLayout from "../components/AppLayout";
import InvestorPropertyGallery, { type InvestorPropertyPhoto } from "../components/InvestorPropertyGallery";

type MarketplaceLoan = {
  id: number;
  loan_application_id: string;
  loan_number?: number | null;
  business_name?: string | null;
  borrower_name?: string | null;
  apn?: string | null;
  state?: string | null;
  acreage?: number | null;
  risk_score?: string | null;
  land_value?: number | null;
  loan_amount?: number | null;
  funding_goal?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  investor_interest_rate?: number | null;
  status?: string | null;
  created_at?: string | null;
  borrower_video_path?: string | null;
  borrower_video_status?: string | null;
};

type InvestorWallet = { available_balance?: number | null };

type VideoProps = { storagePath: string };
function ApprovedBorrowerVideo({ storagePath }: VideoProps) {
  const [urls, setUrls] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    setUrls([]);
    setCandidateIndex(0);

    void resolveStorageUrls("borrower-videos", storagePath).then((resolved) => {
      if (!active) return;
      setUrls(resolved);
      setState(resolved.length ? "ready" : "unavailable");
    });

    return () => { active = false; };
  }, [storagePath]);

  if (state === "loading") return <div className="mt-5 rounded-2xl bg-slate-800 p-5 text-slate-300">Loading approved borrower video…</div>;
  if (state === "unavailable" || !urls[candidateIndex]) return <div className="mt-5 rounded-2xl border border-amber-700/40 bg-amber-950/30 p-5 text-amber-100">Approved borrower video is temporarily unavailable.</div>;

  return (
    <video
      key={urls[candidateIndex]}
      controls
      playsInline
      preload="metadata"
      className="mt-5 w-full rounded-2xl bg-black"
      src={urls[candidateIndex]}
      onLoadedMetadata={() => setState("ready")}
      onError={() => {
        const nextIndex = candidateIndex + 1;
        if (nextIndex < urls.length) {
          console.warn("Borrower video failed; trying another file from the same loan folder", {
            storagePath,
            candidateIndex: nextIndex,
          });
          setCandidateIndex(nextIndex);
        } else {
          console.error("All borrower video candidates failed to play", { storagePath });
          setState("unavailable");
        }
      }}
    >
      Your browser does not support video playback.
    </video>
  );
}

export default function InvestorMarketplace() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<MarketplaceLoan[]>([]);
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);
  const [photosByLoan, setPhotosByLoan] = useState<Record<string, InvestorPropertyPhoto[]>>({});
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMarketplace = useCallback(async (silent = false) => {
    if (!supabase) return;
    silent ? setRefreshing(true) : setLoading(true);
    setErrorMessage("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { navigate("/login", { replace: true }); return; }

      const [{ data: walletData, error: walletError }, { data: loanData, error: loanError }] = await Promise.all([
        supabase.from("investor_wallets").select("*").eq("user_id", authData.user.id).maybeSingle(),
        supabase.from("marketplace_loans").select("*").eq("status", "Open").order("created_at", { ascending: false }),
      ]);
      if (walletError) throw walletError;
      if (loanError) throw loanError;

      let marketplaceLoans = (loanData ?? []) as MarketplaceLoan[];
      setWallet(walletData ?? null);
      const applicationIds = [...new Set(marketplaceLoans.map((loan) => String(loan.loan_application_id)).filter(Boolean))];

      if (applicationIds.length) {
        const { data: applications } = await supabase.from("loan_applications").select("id,borrower_video_path,borrower_video_status").in("id", applicationIds);
        const byId = new Map((applications ?? []).map((row: any) => [String(row.id), row]));
        marketplaceLoans = marketplaceLoans.map((loan) => {
          const application = byId.get(String(loan.loan_application_id));
          return { ...loan, borrower_video_path: application?.borrower_video_path ?? loan.borrower_video_path, borrower_video_status: application?.borrower_video_status ?? loan.borrower_video_status };
        });

        const { data: photoData, error: photoError } = await supabase
          .from("property_photos")
          .select("id,loan_application_id,storage_path,caption,is_cover,created_at,review_status")
          .in("loan_application_id", applicationIds)
          .eq("review_status", "approved")
          .order("created_at", { ascending: true });

        if (photoError) {
          console.error("Approved property photos could not be loaded", photoError.message);
          setPhotosByLoan({});
        } else {
          const hydrated = await Promise.all((photoData ?? []).map(async (photo: any) => ({ ...photo, signed_url: await resolveStorageUrl("property-photos", photo.storage_path) })));
          const grouped: Record<string, InvestorPropertyPhoto[]> = {};
          hydrated.filter((photo) => Boolean(photo.signed_url)).forEach((photo) => {
            const key = String(photo.loan_application_id);
            grouped[key] = [...(grouped[key] ?? []), photo as InvestorPropertyPhoto];
          });
          setPhotosByLoan(grouped);
        }
      } else {
        setPhotosByLoan({});
      }
      setLoans(marketplaceLoans);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to load investment opportunities.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => { void loadMarketplace(); }, [loadMarketplace]);

  function money(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }

  if (loading) return <AppLayout><div className="p-8 text-center">Loading investment marketplace…</div></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-3xl font-black text-slate-950">Investment Marketplace</h1><p className="text-slate-600">Invest in reviewed land-backed opportunities.</p></div>
          <button type="button" onClick={() => void loadMarketplace(true)} className="rounded-xl bg-slate-700 px-5 py-3 font-bold text-white">{refreshing ? "Refreshing…" : "Refresh Opportunities"}</button>
        </div>
        {errorMessage && <div className="mb-5 rounded-xl bg-rose-100 p-4 text-rose-800">{errorMessage}</div>}
        <div className="mb-8 rounded-2xl bg-slate-950 p-6 text-white"><div className="text-sm text-slate-400">Available Wallet Cash</div><div className="mt-1 text-4xl font-black">{money(wallet?.available_balance)}</div></div>
        <div className="space-y-8">
          {loans.map((loan) => {
            const goal = Number(loan.funding_goal ?? loan.loan_amount ?? 0);
            const funded = Number(loan.amount_funded ?? 0);
            const remaining = Math.max(Number(loan.amount_remaining ?? goal - funded), 0);
            const percentage = goal > 0 ? Math.min((funded / goal) * 100, 100) : 0;
            const photos = photosByLoan[String(loan.loan_application_id)] ?? [];
            return (
              <article key={loan.id} className="rounded-3xl bg-[#111] p-6 text-slate-200 shadow-xl">
                <div className="flex items-start justify-between gap-4"><h2 className="text-3xl font-black text-emerald-500">{loan.business_name || "No Business Name"}</h2><span className="rounded-full bg-slate-800 px-4 py-2 font-bold text-violet-300">{loan.status || "Open"}</span></div>
                {photos.length > 0 && <InvestorPropertyGallery photos={photos} loanLabel={loan.business_name || `Loan ${loan.loan_number ?? loan.loan_application_id}`} />}
                {loan.borrower_video_status === "approved" && loan.borrower_video_path && <ApprovedBorrowerVideo storagePath={loan.borrower_video_path} />}
                <div className="mt-6 space-y-2 text-xl">
                  <p><strong>Borrower:</strong> {loan.borrower_name || "Not provided"}</p><p><strong>APN:</strong> {loan.apn || "Not provided"}</p><p><strong>State:</strong> {loan.state || "Not provided"}</p><p><strong>Acres:</strong> {loan.acreage ?? "Not provided"}</p><p><strong>Risk Score:</strong> {loan.risk_score || "Not rated"}</p>
                  <div className="h-3"/><p><strong>Land Value:</strong> {money(loan.land_value)}</p><p><strong>Loan Amount:</strong> {money(goal)}</p><p><strong>Investor Return:</strong> {Number(loan.investor_interest_rate || 9).toFixed(2)}%</p><p><strong>Amount Remaining:</strong> {money(remaining)}</p><p><strong>Loan ID:</strong> {loan.loan_number ?? loan.loan_application_id}</p>
                </div>
                <div className="mt-8"><div className="flex justify-between"><span>Funding Progress</span><strong>{percentage.toFixed(0)}%</strong></div><div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-emerald-500" style={{ width: `${percentage}%` }} /></div><div className="mt-3 flex justify-between"><span>{money(funded)} funded</span><span>{money(goal)} goal</span></div></div>
                <label className="mt-7 block text-lg font-bold">Investment amount<input type="number" min="100" step="100" value={amounts[loan.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [loan.id]: event.target.value }))} placeholder="Minimum investment $100" className="mt-3 w-full rounded-xl border border-slate-500 bg-slate-700 p-4 text-white" /></label>
                <button type="button" onClick={() => navigate(`/payment?loanId=${loan.loan_number ?? loan.loan_application_id}&amount=${Number(amounts[loan.id] || 0)}`)} className="mt-5 w-full rounded-xl bg-emerald-600 py-4 text-xl font-black text-white">Invest From Wallet</button>
              </article>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
