import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AppLayout from "../components/AppLayout";
import VideoUpload from "../components/VideoUpload";
import PropertyGallery from "../components/PropertyGallery";
import MapEmbed from "../components/MapEmbed";
import RepaymentSchedule from "../components/RepaymentSchedule";
import KYCWorkflow from "../components/KYCWorkflow";

type LoanApplication = {
  Id?: number;
  id?: number;
  user_id?: string | null;
  created_at?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  state?: string | null;
  land_type?: string | null;
  acreage?: number | null;
  land_value?: number | null;
  loan_amount?: number | null;
  status?: string | null;
  repayment_term_months?: number | null;
  interest_rate_percent?: number | null;
  borrower_interest_rate?: number | null;
  property_address?: string | null;
  apn?: string | null;
  county?: string | null;
  borrower_video_path?: string | null;
  borrower_video_status?: string | null;
};

type MarketplaceLoan = {
  id: number;
  loan_application_id?: number | null;
  business_name?: string | null;
  funding_goal?: number | null;
  loan_amount?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  investor_interest_rate?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type LoanDocument = {
  id: string;
  user_id?: string | null;
  loan_id?: number | null;
  loan_application_id?: number | null;
  application_id?: number | null;
  document_type?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  storage_path?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [marketplaceLoans, setMarketplaceLoans] = useState<MarketplaceLoan[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);

  function getApplicationId(application: LoanApplication) {
    return Number(application.Id ?? application.id ?? 0);
  }

  const loadDashboard = useCallback(async (silent = false) => {
    if (!supabase) { setErrorMessage("Supabase is not configured."); setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    setErrorMessage("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { window.location.href = "/login"; return; }

      setCurrentUserId(user.id);
      setEmail(user.email || "");

      const { data: applicationData, error: applicationError } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (applicationError) throw applicationError;

      const borrowerApplications = (applicationData as LoanApplication[] | null) || [];
      setApplications(borrowerApplications);

      const applicationIds = borrowerApplications
        .map((a) => getApplicationId(a))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (applicationIds.length === 0) {
        setMarketplaceLoans([]);
        setDocuments([]);
        setLastUpdated(new Date());
        return;
      }

      const [{ data: marketplaceData }, { data: documentData }] = await Promise.all([
        supabase.from("marketplace_loans").select("*").in("loan_application_id", applicationIds).order("created_at", { ascending: false }),
        supabase.from("loan_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      setMarketplaceLoans((marketplaceData as MarketplaceLoan[] | null) || []);
      setDocuments((documentData as LoanDocument[] | null) || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to load the borrower dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Supabase Realtime: live funding sync
  useEffect(() => {
    if (!supabase) return;
    let cleanup: (() => void) | undefined;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !supabase) return;
      const ch = supabase
        .channel("borrower-marketplace-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_loans" }, () => {
          loadDashboard(true);
        })
        .subscribe();
      cleanup = () => { supabase?.removeChannel(ch); };
    });
    return () => cleanup?.();
  }, [loadDashboard]);

  function money(value: unknown) {
    return Number(value || 0).toLocaleString(undefined, {
      style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2,
    });
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString();
  }

  function getMarketplaceLoan(application: LoanApplication) {
    const id = getApplicationId(application);
    return marketplaceLoans.find((l) => Number(l.loan_application_id || 0) === id);
  }

  function getDocuments(application: LoanApplication) {
    const id = getApplicationId(application);
    return documents.filter((d) => {
      const lid = Number(d.loan_application_id ?? d.loan_id ?? d.application_id ?? 0);
      const ownedByUser = !d.user_id || d.user_id === currentUserId || d.user_id === application.user_id;
      return lid === id && ownedByUser;
    });
  }

  function getFundingValues(application: LoanApplication, ml?: MarketplaceLoan) {
    const goal = Number(ml?.funding_goal ?? ml?.loan_amount ?? application.loan_amount ?? 0);
    const funded = Number(ml?.amount_funded || 0);
    const remaining = ml?.amount_remaining != null ? Math.max(Number(ml.amount_remaining), 0) : Math.max(goal - funded, 0);
    const percentage = goal > 0 ? Math.min(Math.max((funded / goal) * 100, 0), 100) : 0;
    return { goal, funded, remaining, percentage };
  }

  function statusClasses(status?: string | null) {
    const s = String(status || "pending").toLowerCase();
    if (["funded", "approved", "active", "completed"].includes(s)) return "bg-emerald-100 text-emerald-800";
    if (["open", "published", "funding"].includes(s)) return "bg-blue-100 text-blue-800";
    if (["denied", "rejected", "defaulted", "failed"].includes(s)) return "bg-rose-100 text-rose-800";
    return "bg-amber-100 text-amber-800";
  }

  function docStatusClasses(status?: string | null) {
    const s = String(status || "submitted").toLowerCase();
    if (["approved", "verified", "accepted"].includes(s)) return "bg-emerald-100 text-emerald-700";
    if (["rejected", "denied", "failed"].includes(s)) return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  }

  const totalRequested = useMemo(() => applications.reduce((s, a) => s + Number(a.loan_amount || 0), 0), [applications]);
  const totalFunded = useMemo(() => marketplaceLoans.reduce((s, l) => s + Number(l.amount_funded || 0), 0), [marketplaceLoans]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
            <p className="text-sm">Loading your dashboard…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-2xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Borrower Portal</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your Land Loan Dashboard</h1>
          <p className="mt-2 text-slate-400">{email}</p>
          {lastUpdated && (
            <p className="mt-1 text-xs text-slate-500">
              Live data {refreshing ? "· refreshing…" : `· last updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => (window.location.href = "/loan-application")} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500">New Application</button>
            <button onClick={() => (window.location.href = "/loan-documents")} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20">Upload Documents</button>
            <button onClick={() => loadDashboard()} disabled={refreshing} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40 hover:bg-white/20">{refreshing ? "Refreshing…" : "Refresh"}</button>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{errorMessage}</div>
        )}

        {/* KYC */}
        <div className="mt-6">
          <KYCWorkflow />
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Applications", String(applications.length), ""],
            ["Total Requested", money(totalRequested), ""],
            ["Total Funded", money(totalFunded), "green"],
            ["Documents", String(documents.length), ""],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <p className={`mt-2 text-2xl font-black ${color === "green" ? "text-emerald-700" : "text-slate-950"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Applications */}
        <div className="mt-8">
          <h2 className="text-xl font-black text-slate-950">My Applications</h2>

          {applications.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-slate-500">No applications yet. Start by applying for a land-backed loan.</p>
              <button onClick={() => (window.location.href = "/loan-application")} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white">Apply Now</button>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {applications.map((application) => {
                const applicationId = getApplicationId(application);
                const ml = getMarketplaceLoan(application);
                const appDocs = getDocuments(application);
                const { goal, funded, remaining, percentage } = getFundingValues(application, ml);
                const displayedStatus = ml?.status || application.status || "Pending";
                const isExpanded = expandedLoan === applicationId;
                const rate = Number(application.borrower_interest_rate || application.interest_rate_percent || 9);
                const term = Number(application.repayment_term_months || 36);

                return (
                  <article key={applicationId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Card header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Application #{applicationId}</p>
                        <h3 className="mt-1 text-xl font-black text-slate-950">{application.business_name || application.full_name || "Land Loan"}</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(displayedStatus)}`}>{displayedStatus}</span>
                        <button
                          type="button"
                          onClick={() => setExpandedLoan(isExpanded ? null : applicationId)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? "Collapse ↑" : "Expand ↓"}
                        </button>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Summary grid */}
                      <div className="grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p><strong>Loan Amount:</strong> {money(application.loan_amount)}</p>
                          <p><strong>Land Value:</strong> {money(application.land_value)}</p>
                          <p><strong>Rate:</strong> {rate}%</p>
                          <p><strong>Term:</strong> {term} months</p>
                        </div>
                        <div className="space-y-1">
                          <p><strong>Land Type:</strong> {application.land_type || "N/A"}</p>
                          <p><strong>Acres:</strong> {application.acreage ?? "N/A"}</p>
                          <p><strong>State:</strong> {application.state || "N/A"}</p>
                          <p><strong>Submitted:</strong> {formatDate(application.created_at)}</p>
                        </div>
                      </div>

                      {/* Funding progress */}
                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h4 className="text-sm font-bold text-slate-800">Live Funding Progress</h4>
                        {ml ? (
                          <>
                            <div className="mt-3 flex justify-between text-xs text-slate-500">
                              <span>{money(funded)} funded</span>
                              <span className="font-bold text-slate-800">{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                              <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${percentage}%` }} />
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                              <div className="rounded-lg bg-white p-2 text-center"><p className="text-slate-400">Goal</p><p className="font-black text-slate-800">{money(goal)}</p></div>
                              <div className="rounded-lg bg-emerald-50 p-2 text-center"><p className="text-emerald-600">Funded</p><p className="font-black text-emerald-700">{money(funded)}</p></div>
                              <div className="rounded-lg bg-white p-2 text-center"><p className="text-slate-400">Remaining</p><p className="font-black text-slate-800">{money(remaining)}</p></div>
                            </div>
                            {percentage >= 100 && (
                              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">
                                🎉 Fully Funded — disbursement pending
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-amber-700">Not yet published to marketplace. Awaiting admin approval.</p>
                        )}
                      </div>

                      {/* Expanded sections */}
                      {isExpanded && (
                        <div className="mt-6 space-y-6">
                          {/* Video upload */}
                          <VideoUpload
                            loanApplicationId={applicationId}
                            existingPath={application.borrower_video_path}
                            existingStatus={application.borrower_video_status}
                            onUploaded={() => loadDashboard(true)}
                          />

                          {/* Property gallery */}
                          <PropertyGallery loanApplicationId={applicationId} />

                          {/* Map */}
                          {(application.property_address || application.apn) && (
                            <MapEmbed
                              address={application.property_address}
                              apn={application.apn}
                              county={application.county}
                              state={application.state}
                            />
                          )}

                          {/* Repayment schedule */}
                          <RepaymentSchedule
                            loanAmount={Number(application.loan_amount || 0)}
                            annualRatePercent={rate}
                            termMonths={term}
                          />

                          {/* Documents */}
                          <div className="rounded-2xl border border-slate-200 bg-white p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h4 className="font-bold text-slate-900">Submitted Documents ({appDocs.length})</h4>
                              <button
                                type="button"
                                onClick={() => { window.location.href = `/loan-documents?loanId=${applicationId}`; }}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                              >
                                Upload Document
                              </button>
                            </div>

                            {appDocs.length === 0 ? (
                              <p className="mt-3 text-sm text-amber-700">No documents uploaded yet.</p>
                            ) : (
                              <div className="mt-4 grid gap-3">
                                {appDocs.map((doc) => {
                                  const docUrl = doc.file_url || doc.public_url || "";
                                  const docStatus = doc.status || "Submitted";
                                  return (
                                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                                      <div>
                                        <p className="font-semibold capitalize text-slate-800">
                                          {String(doc.document_type || "document").replace(/_/g, " ")}
                                        </p>
                                        <p className="text-xs text-slate-500">{doc.file_name}</p>
                                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${docStatusClasses(docStatus)}`}>{docStatus}</span>
                                      </div>
                                      {docUrl && (
                                        <a href={docUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">View</a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
