import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart } from "../components/PortfolioCharts";
import { supabase } from "../lib/supabase";
import AppLayout from "../components/AppLayout";
import VideoReviewPanel from "../components/VideoReviewPanel";
import GeneratedDocumentsPanel from "../components/GeneratedDocumentsPanel";

type LoanApplication = {
  id: string;
  loan_number?: number | null;
  user_id?: string | null;
  created_at?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  apn?: string | null;
  property_address?: string | null;
  state?: string | null;
  acreage?: number | null;
  land_value?: number | null;
  loan_amount?: number | null;
  repayment_term_months?: number | null;
  status?: string | null;
  borrower_interest_rate?: number | null;
  investor_interest_rate?: number | null;
  company_spread_rate?: number | null;
  amount_funded?: number | null;
  amount_remaining?: number | null;
  risk_score?: string | null;
  underwriter_notes?: string | null;
  published_to_marketplace?: boolean | null;
  borrower_video_path?: string | null;
  borrower_video_status?: string | null;
  borrower_video_admin_notes?: string | null;
  borrower_video_reviewed_at?: string | null;
  borrower_video_reviewed_by?: string | null;
  county?: string | null;
};

type LoanDocument = {
  id: string;
  loan_application_id?: string | null;
  loan_id?: string | null;
  application_id?: string | null;
  document_type?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
};

type EditingValues = {
  borrower_interest_rate: string;
  investor_interest_rate: string;
  risk_score: string;
  underwriter_notes: string;
  published_to_marketplace: boolean;
};

/** Inline video player with approve/reject controls for admin */
function AdminVideoPlayer({
  storagePath,
  loanId,
  onReviewed,
}: {
  storagePath: string;
  loanId: string;
  onReviewed: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.storage
      .from("borrower-videos")
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [storagePath]);

  async function review(status: string) {
    if (!supabase) return;
    setSaving(true);
    await supabase
      .from("loan_applications")
      .update({ borrower_video_status: status, borrower_video_admin_notes: notes, borrower_video_reviewed_at: new Date().toISOString() })
      .eq("id", loanId);
    setSaving(false);
    onReviewed();
  }

  return (
    <div className="mt-4 space-y-3">
      {url ? (
        <video src={url} controls className="w-full rounded-xl" preload="metadata" />
      ) : (
        <p className="text-sm text-slate-400">Loading video…</p>
      )}
      <textarea
        rows={2}
        placeholder="Admin notes for borrower"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
      />
      <div className="flex gap-2">
        <button disabled={saving} onClick={() => review("approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Approve Video</button>
        <button disabled={saving} onClick={() => review("more_information")} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Request Changes</button>
        <button disabled={saving} onClick={() => review("rejected")} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Reject</button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [editing, setEditing] = useState<Record<string, EditingValues>>({});
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const money = (value: unknown) =>
    Number(value || 0).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  function monthlyPayment(amount: number, annualRate: number, months: number) {
    if (!amount || !months) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return amount / months;
    return (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  }

  const loadApplications = useCallback(async (silent = false) => {
    if (!supabase) return;
    silent ? setRefreshing(true) : setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const loans = (data as LoanApplication[] | null) || [];
    setApplications(loans);

    const nextEditing: Record<string, EditingValues> = {};
    loans.forEach((loan) => {
      nextEditing[loan.id] = {
        borrower_interest_rate: String(loan.borrower_interest_rate ?? 10),
        investor_interest_rate: String(loan.investor_interest_rate ?? 9),
        risk_score: loan.risk_score || "Pending",
        underwriter_notes: loan.underwriter_notes || "",
        published_to_marketplace: Boolean(loan.published_to_marketplace),
      };
    });
    setEditing(nextEditing);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!supabase) return;
    setMessage("");
    setErrorMessage("");
    const { data, error } = await supabase
      .from("loan_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Keep the main dashboard usable if review columns or RLS are not ready yet.
      console.error("Loan document load failed:", error.message);
      setErrorMessage(`Unable to refresh documents: ${error.message}`);
      return;
    }

    const rows = (data as LoanDocument[] | null) || [];
    setDocuments(rows);
    const notes: Record<string, string> = {};
    rows.forEach((document) => {
      notes[document.id] = document.admin_notes || "";
    });
    setDocumentNotes(notes);
    setMessage(`Documents refreshed: ${rows.length} found.`);
  }, []);

  const checkAdmin = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      navigate("/login", { replace: true });
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      setErrorMessage(adminError.message);
      setLoading(false);
      return;
    }

    if (!admin) {
      navigate("/", { replace: true });
      return;
    }

    setAllowed(true);
    await Promise.all([loadApplications(), loadDocuments()]);
  }, [loadApplications, loadDocuments, navigate]);

  useEffect(() => {
    void checkAdmin();
  }, [checkAdmin]);

  // Realtime: live admin analytics totals
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel("admin-applications-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_applications" },
        () => void loadApplications(true)
      )
      .subscribe();
    return () => { supabase?.removeChannel(ch); };
  }, [loadApplications]);

  function getDocumentLoanId(document: LoanDocument) {
    return document.loan_application_id ?? document.loan_id ?? document.application_id ?? "";
  }

  function updateEdit(id: string, field: keyof EditingValues, value: string | boolean) {
    setEditing((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  }

  function getLoanDocuments(loanId: string) {
    return documents.filter((document) =>
      String(getDocumentLoanId(document)) === String(loanId)
    );
  }

  async function saveLoanTerms(id: string) {
    if (!supabase) return;
    setMessage("");
    setErrorMessage("");

    const loan = applications.find((item) => item.id === id);
    const values = editing[id];
    if (!loan || !values) {
      setErrorMessage("Loan application data was not found.");
      return;
    }

    const borrowerRate = Number(values.borrower_interest_rate);
    const investorRate = Number(values.investor_interest_rate);
    if (!Number.isFinite(borrowerRate) || !Number.isFinite(investorRate)) {
      setErrorMessage("Enter valid interest rates.");
      return;
    }
    if (borrowerRate < 0 || investorRate < 0 || investorRate > borrowerRate) {
      setErrorMessage("Rates must be positive and the investor rate cannot exceed the borrower rate.");
      return;
    }

    const loanAmount = Number(loan.loan_amount || 0);
    const amountFunded = Number(loan.amount_funded || 0);
    const amountRemaining = Math.max(loanAmount - amountFunded, 0);
    const spreadRate = Number((borrowerRate - investorRate).toFixed(2));

    setSavingId(id);
    try {
      const { error: applicationError } = await supabase
        .from("loan_applications")
        .update({
          borrower_interest_rate: borrowerRate,
          investor_interest_rate: investorRate,
          company_spread_rate: spreadRate,
          amount_funded: amountFunded,
          amount_remaining: amountRemaining,
          risk_score: values.risk_score,
          underwriter_notes: values.underwriter_notes,
          published_to_marketplace: values.published_to_marketplace,
        })
        .eq("id", id);

      if (applicationError) throw applicationError;

      if (values.published_to_marketplace) {
        const { error: marketplaceError } = await supabase
          .from("marketplace_loans")
          .upsert(
            {
              loan_application_id: id,
              loan_number: loan.loan_number,
              business_name: loan.business_name || "Land-backed loan",
              borrower_name: loan.full_name || "",
              apn: loan.apn || "",
              state: loan.state || "",
              acreage: Number(loan.acreage || 0),
              land_value: Number(loan.land_value || 0),
              loan_amount: loanAmount,
              borrower_interest_rate: borrowerRate,
              investor_interest_rate: investorRate,
              company_spread_rate: spreadRate,
              repayment_term_months: Number(loan.repayment_term_months || 36),
              risk_score: values.risk_score,
              funding_goal: loanAmount,
              amount_funded: amountFunded,
              amount_remaining: amountRemaining,
              status: amountRemaining <= 0 ? "Funded" : "Open",
            },
            { onConflict: "loan_application_id" }
          );
        if (marketplaceError) throw marketplaceError;
      } else {
        const { error: removeError } = await supabase
          .from("marketplace_loans")
          .delete()
          .eq("loan_application_id", id);
        if (removeError) throw removeError;
      }

      setMessage(`Loan #${loan.loan_number ?? id} was saved successfully.`);
      await loadApplications(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to save the loan review.");
    } finally {
      setSavingId(null);
    }
  }

  async function createClosingCenter(loan: LoanApplication) {
    if (!supabase || !loan.user_id) return;

    const amount = Number(loan.loan_amount || 0);
    const term = Number(loan.repayment_term_months || 36);
    const values = editing[loan.id];
    const borrowerRate = Number(values?.borrower_interest_rate ?? loan.borrower_interest_rate ?? 10);
    const investorRate = Number(values?.investor_interest_rate ?? loan.investor_interest_rate ?? 9);
    const monthlyRate = borrowerRate / 100 / 12;
    const payment = monthlyRate === 0
      ? amount / Math.max(term, 1)
      : (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term));

    const { data: closing, error: closingError } = await supabase
      .from("loan_closings")
      .upsert({
        loan_application_id: loan.id,
        borrower_user_id: loan.user_id,
        stage: "borrower_actions",
        progress_percent: 12,
        approved_loan_amount: amount,
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        repayment_term_months: term,
        monthly_payment: Number(payment.toFixed(2)),
        terms_locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "loan_application_id" })
      .select("id")
      .single();
    if (closingError) throw closingError;

    const tasks = [
      ["underwriting", "Underwriting approved", "complete", 1],
      ["video", "Upload borrower introduction video", loan.borrower_video_path ? "submitted" : "pending", 2],
      ["required_documents", "Upload required property and identity documents", "pending", 3],
      ["loan_documents", "Review generated loan documents", "pending", 4],
      ["signatures", "Sign closing documents", "pending", 5],
      ["investor_funding", "Investor funding complete", "pending", 6],
      ["disbursement", "Funds released", "pending", 7],
    ].map(([task_key, title, taskStatus, sort_order]) => ({
      loan_closing_id: closing.id,
      loan_application_id: loan.id,
      task_key, title, status: taskStatus, sort_order,
      completed_at: taskStatus === "complete" ? new Date().toISOString() : null,
    }));

    const { error: taskError } = await supabase
      .from("closing_tasks")
      .upsert(tasks, { onConflict: "loan_application_id,task_key" });
    if (taskError) throw taskError;

    const generatedDocuments = [
      ["promissory_note", "Promissory Note"],
      ["deed_of_trust", "California Deed of Trust — Attorney Review Required"],
      ["payment_schedule", "Payment Schedule"],
      ["borrower_certification", "Borrower Certification"],
      ["esign_consent", "Electronic Signature Consent"],
      ["closing_summary", "Closing Summary"],
    ].map(([document_type, title]) => ({
      loan_application_id: Number(loan.id),
      borrower_user_id: loan.user_id,
      document_type,
      title,
      status: "ready_for_review",
      terms_snapshot: {
        loan_number: loan.loan_number ?? Number(loan.id),
        borrower_name: loan.full_name || "",
        business_name: loan.business_name || "",
        property_address: loan.property_address || "",
        apn: loan.apn || "",
        county: loan.county || "",
        state: loan.state || "CA",
        approved_loan_amount: amount,
        borrower_interest_rate: borrowerRate,
        investor_interest_rate: investorRate,
        repayment_term_months: term,
        monthly_payment: Number(payment.toFixed(2)),
        generated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }));

    const { error: generatedDocumentError } = await supabase
      .from("generated_loan_documents")
      .upsert(generatedDocuments, { onConflict: "loan_application_id,document_type" });
    if (generatedDocumentError) throw generatedDocumentError;

    await supabase.from("closing_tasks").update({ status: "submitted" })
      .eq("loan_application_id", loan.id).eq("task_key", "loan_documents");

    await supabase.from("borrower_notifications").insert({
      user_id: loan.user_id,
      loan_application_id: loan.id,
      title: "Your Secured Landing loan was approved",
      message: "Your approved terms are ready. Open the Closing Center to upload your introduction video, review required documents and track funding.",
      notification_type: "loan_approved",
    });

    await supabase.from("loan_timeline_events").insert({
      loan_application_id: loan.id,
      event_key: "loan_approved",
      title: "Loan approved",
      description: "Approved terms were locked and the Closing Center was created.",
    });
  }

  async function updateStatus(id: string, status: string) {
    if (!supabase) return;
    setMessage("");
    setErrorMessage("");
    setSavingId(id);

    try {
      const loan = applications.find((item) => item.id === id);
      if (!loan) throw new Error("Loan application was not found.");

      const loanAmount = Number(loan.loan_amount || 0);
      const payload: Record<string, unknown> = { status };
      if (status === "Funded") {
        payload.amount_funded = loanAmount;
        payload.amount_remaining = 0;
        payload.published_to_marketplace = true;
      }

      const { error: applicationError } = await supabase
        .from("loan_applications")
        .update(payload)
        .eq("id", id);
      if (applicationError) throw applicationError;

      if (status === "Approved") {
        await createClosingCenter({ ...loan, status });
      }

      if (status === "Funded") {
        const values = editing[id];
        const borrowerRate = Number(values?.borrower_interest_rate ?? loan.borrower_interest_rate ?? 10);
        const investorRate = Number(values?.investor_interest_rate ?? loan.investor_interest_rate ?? 9);
        const { error: marketplaceError } = await supabase
          .from("marketplace_loans")
          .upsert(
            {
              loan_application_id: id,
              loan_number: loan.loan_number,
              business_name: loan.business_name || "Land-backed loan",
              borrower_name: loan.full_name || "",
              apn: loan.apn || "",
              state: loan.state || "",
              acreage: Number(loan.acreage || 0),
              land_value: Number(loan.land_value || 0),
              loan_amount: loanAmount,
              funding_goal: loanAmount,
              amount_funded: loanAmount,
              amount_remaining: 0,
              borrower_interest_rate: borrowerRate,
              investor_interest_rate: investorRate,
              company_spread_rate: Number((borrowerRate - investorRate).toFixed(2)),
              repayment_term_months: Number(loan.repayment_term_months || 36),
              risk_score: values?.risk_score || loan.risk_score || "Pending",
              status: "Funded",
            },
            { onConflict: "loan_application_id" }
          );
        if (marketplaceError) throw marketplaceError;
      } else {
        const marketStatus = status === "Approved" ? "Open" : status === "Denied" ? "Closed" : null;
        if (marketStatus) {
          const { error: marketplaceError } = await supabase
            .from("marketplace_loans")
            .update({ status: marketStatus })
            .eq("loan_application_id", id);
          if (marketplaceError) throw marketplaceError;
        }
      }

      setMessage(`Loan #${loan.loan_number || id} status changed to ${status}.`);
      await loadApplications(true);
    } catch (error: any) {
      setErrorMessage(error?.message || "Unable to update loan status.");
    } finally {
      setSavingId(null);
    }
  }

  async function createDocumentUrl(document: LoanDocument) {
    if (!supabase) return "";
    if (document.storage_path) {
      const { data, error } = await supabase.storage
        .from("loan-documents")
        .createSignedUrl(document.storage_path, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    }
    return document.file_url || document.public_url || "";
  }

  async function openDocument(document: LoanDocument) {
    const url = await createDocumentUrl(document);
    if (!url) {
      setErrorMessage("A document link could not be created.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function reviewDocument(documentId: string, status: "approved" | "rejected" | "more_information") {
    if (!supabase) return;
    setReviewingDocumentId(documentId);
    setErrorMessage("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Admin session expired.");

      const { error } = await supabase
        .from("loan_documents")
        .update({
          status,
          admin_notes: documentNotes[documentId] || "",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      if (error) throw error;

      setMessage(`Document marked ${status.replace("_", " ")}.`);
      await loadDocuments();
    } catch (error: any) {
      setErrorMessage(error?.message || "Document review failed.");
    } finally {
      setReviewingDocumentId(null);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  const totals = useMemo(() => {
    const volume = applications.reduce((sum, loan) => sum + Number(loan.loan_amount || 0), 0);
    const funded = applications.reduce((sum, loan) => sum + Number(loan.amount_funded || 0), 0);
    const pendingLoans = applications.filter((loan) => String(loan.status || "Pending").toLowerCase() === "pending").length;
    const pendingVideos = applications.filter((loan) =>
      Boolean(loan.borrower_video_path) &&
      !["approved", "rejected"].includes(String(loan.borrower_video_status || "submitted").toLowerCase())
    ).length;
    const pendingDocuments = documents.filter((document) =>
      !["approved", "rejected"].includes(String(document.status || "submitted").toLowerCase())
    ).length;
    return { volume, funded, pending: pendingLoans + pendingVideos + pendingDocuments };
  }, [applications, documents]);

  const videoApplications = useMemo(
    () => applications.filter((loan) => Boolean(loan.borrower_video_path)),
    [applications]
  );

  function statusClasses(status?: string | null) {
    const normalized = String(status || "Pending").toLowerCase();
    if (normalized === "approved" || normalized === "funded") return "bg-emerald-100 text-emerald-800";
    if (normalized === "denied") return "bg-rose-100 text-rose-800";
    if (normalized === "open") return "bg-blue-100 text-blue-800";
    return "bg-amber-100 text-amber-800";
  }

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center text-white">
          <img src="/Logo.png" alt="Secured Landing" className="mx-auto h-16 w-16 rounded-2xl object-contain" />
          <p className="mt-5 text-lg font-semibold">Loading secure admin workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-2xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Operations center</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Underwrite with clarity. Manage every dollar with confidence.</h1>
          <p className="mt-4 max-w-2xl text-slate-300">Review collateral, documents, rates, marketplace status and funding progress from one secure command center.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void Promise.all([loadApplications(true), loadDocuments()])}
              className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/20"
            >
              {refreshing ? "Refreshing…" : "Refresh Data"}
            </button>
          </div>
        </section>

        {(errorMessage || message) && (
          <div className={`mt-6 rounded-2xl border p-4 font-semibold ${errorMessage ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {errorMessage || message}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Applications", applications.length],
            ["Requested volume", money(totals.volume)],
            ["Amount funded", money(totals.funded)],
            ["Pending reviews", totals.pending],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Media review queue</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Borrower introduction videos</h2>
              <p className="mt-1 text-sm text-slate-600">Review uploaded videos here without scrolling through every loan application.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-800">{videoApplications.length} uploaded</span>
          </div>

          {videoApplications.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
              No borrower videos are currently available. Refresh after a borrower completes an upload.
            </div>
          ) : (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              {videoApplications.map((loan) => (
                <div key={`video-${loan.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Loan #{loan.loan_number ?? loan.id}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">{loan.business_name || loan.full_name || "Borrower video"}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses(loan.borrower_video_status)}`}>
                      {String(loan.borrower_video_status || "submitted").replaceAll("_", " ")}
                    </span>
                  </div>
                  <VideoReviewPanel
                    applicationId={loan.id}
                    storagePath={loan.borrower_video_path!}
                    status={loan.borrower_video_status}
                    existingNotes={loan.borrower_video_admin_notes}
                    onReviewed={() => loadApplications(true)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Analytics Charts */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Loan Volume by Status</h2>
            <p className="mt-0.5 text-xs text-slate-400">Total requested ($) grouped by current status</p>
            <div className="mt-5">
              <BarChart
                height={160}
                valueFormatter={(v) =>
                  v >= 1_000_000
                    ? `$${(v / 1_000_000).toFixed(1)}M`
                    : `$${(v / 1_000).toFixed(0)}K`
                }
                data={(() => {
                  const map: Record<string, number> = {};
                  applications.forEach((a) => {
                    const s = String(a.status || "Pending");
                    map[s] = (map[s] ?? 0) + Number(a.loan_amount || 0);
                  });
                  const COLORS: Record<string, string> = {
                    Pending: "#f0c84a",
                    Approved: "#4da855",
                    Funded: "#3b82f6",
                    Denied: "#ef4444",
                  };
                  return Object.entries(map).map(([label, value]) => ({
                    label,
                    value,
                    color: COLORS[label] ?? "#94a3b8",
                  }));
                })()}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Monthly Applications</h2>
            <p className="mt-0.5 text-xs text-slate-400">Application count per month (last 6)</p>
            <div className="mt-5">
              <BarChart
                height={160}
                valueFormatter={(v) => String(v)}
                data={(() => {
                  const map: Record<string, number> = {};
                  applications.forEach((a) => {
                    const d = new Date(a.created_at ?? "");
                    if (Number.isNaN(d.getTime())) return;
                    const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                    map[key] = (map[key] ?? 0) + 1;
                  });
                  return Object.entries(map).slice(-6).map(([label, value]) => ({ label, value }));
                })()}
              />
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-6">
          {applications.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">No loan applications found.</div>
          ) : (
            applications.map((loan) => {
              const values = editing[loan.id];
              const loanDocuments = getLoanDocuments(loan.id);
              const loanAmount = Number(loan.loan_amount || 0);
              const landValue = Number(loan.land_value || 0);
              const term = Number(loan.repayment_term_months || 36);
              const borrowerRate = Number(values?.borrower_interest_rate ?? 10);
              const investorRate = Number(values?.investor_interest_rate ?? 9);
              const spread = borrowerRate - investorRate;
              const payment = monthlyPayment(loanAmount, borrowerRate, term);
              const totalRepayment = payment * term;
              const totalInterest = Math.max(totalRepayment - loanAmount, 0);
              const ltv = landValue > 0 ? (loanAmount / landValue) * 100 : 0;
              const isSaving = savingId === loan.id;

              return (
                <article key={loan.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Loan #{loan.loan_number ?? loan.id}</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">{loan.business_name || loan.full_name || "Land-backed loan"}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusClasses(loan.status)}`}>{loan.status || "Pending"}</span>
                  </div>

                  <div className="p-6">
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <h3 className="font-black text-slate-950">Borrower</h3>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><strong>Name:</strong> {loan.full_name || "Not provided"}</p>
                          <p><strong>Email:</strong> {loan.email || "Not provided"}</p>
                          <p><strong>Phone:</strong> {loan.phone || "Not provided"}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <h3 className="font-black text-slate-950">Collateral</h3>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><strong>APN:</strong> {loan.apn || "Not provided"}</p>
                          <p><strong>Address:</strong> {loan.property_address || "Not provided"}</p>
                          <p><strong>State:</strong> {loan.state || "Not provided"}</p>
                          <p><strong>Acres:</strong> {loan.acreage ?? "Not provided"}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 p-5 text-white">
                        <p className="text-sm text-slate-300">Loan-to-value</p>
                        <p className="mt-2 text-4xl font-black">{ltv.toFixed(2)}%</p>
                        <p className="mt-3 text-sm text-slate-300">Land value {money(landValue)} · Request {money(loanAmount)}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Term", `${term} months`],
                        ["Monthly payment", money(payment)],
                        ["Total repayment", money(totalRepayment)],
                        ["Total interest", money(totalInterest)],
                        ["Company spread", `${spread.toFixed(2)}%`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                          <p className="mt-2 font-black text-slate-950">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      <label className="text-sm font-bold text-slate-700">Borrower rate %
                        <input type="number" min="0" step="0.01" value={values?.borrower_interest_rate ?? ""} onChange={(event) => updateEdit(loan.id, "borrower_interest_rate", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
                      </label>
                      <label className="text-sm font-bold text-slate-700">Investor rate %
                        <input type="number" min="0" step="0.01" value={values?.investor_interest_rate ?? ""} onChange={(event) => updateEdit(loan.id, "investor_interest_rate", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
                      </label>
                      <label className="text-sm font-bold text-slate-700">Risk score
                        <select value={values?.risk_score || "Pending"} onChange={(event) => updateEdit(loan.id, "risk_score", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100">
                          <option value="Pending">Pending</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-5 block text-sm font-bold text-slate-700">Underwriter notes
                      <textarea rows={4} value={values?.underwriter_notes || ""} onChange={(event) => updateEdit(loan.id, "underwriter_notes", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" />
                    </label>

                    <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 font-bold text-slate-800">
                      <input type="checkbox" checked={Boolean(values?.published_to_marketplace)} onChange={(event) => updateEdit(loan.id, "published_to_marketplace", event.target.checked)} className="h-5 w-5 accent-emerald-600" />
                      Publish this opportunity to the investor marketplace
                    </label>

                    <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><h3 className="text-lg font-black text-slate-950">Document review</h3><p className="text-sm text-slate-600">{loanDocuments.length} submitted document{loanDocuments.length === 1 ? "" : "s"}</p></div>
                        <button type="button" onClick={() => void loadDocuments()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white">Refresh documents</button>
                      </div>

                      {loanDocuments.length === 0 ? (
                        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">No documents have been linked to this application.</p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {loanDocuments.map((document) => {
                            const isReviewing = reviewingDocumentId === document.id;
                            return (
                              <div key={document.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div><p className="font-black capitalize">{String(document.document_type || "document").replaceAll("_", " ")}</p><p className="mt-1 break-all text-sm text-slate-600">{document.file_name || document.storage_path || "Uploaded file"}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Status: {String(document.status || "submitted").replaceAll("_", " ")}</p></div>
                                  <button type="button" onClick={() => void openDocument(document)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">View</button>
                                </div>
                                <textarea rows={2} placeholder="Admin notes" value={documentNotes[document.id] || ""} onChange={(event) => setDocumentNotes((current) => ({ ...current, [document.id]: event.target.value }))} className="mt-3 w-full rounded-lg border border-slate-300 p-3" />
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button disabled={isReviewing} onClick={() => void reviewDocument(document.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-400">Approve</button>
                                  <button disabled={isReviewing} onClick={() => void reviewDocument(document.id, "more_information")} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-400">More info</button>
                                  <button disabled={isReviewing} onClick={() => void reviewDocument(document.id, "rejected")} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-400">Reject</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Borrower video review */}
                    {loan.borrower_video_path ? (
                      <VideoReviewPanel
                        applicationId={loan.id}
                        storagePath={loan.borrower_video_path}
                        status={loan.borrower_video_status}
                        existingNotes={loan.borrower_video_admin_notes}
                        onReviewed={() => loadApplications(true)}
                      />
                    ) : (
                      <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
                        No borrower video has been submitted for this loan.
                      </div>
                    )}
                    <GeneratedDocumentsPanel applicationId={loan.id} />

                    <div className="mt-7 flex flex-wrap gap-3">
                      <button disabled={isSaving} onClick={() => void saveLoanTerms(loan.id)} className="rounded-xl bg-violet-600 px-5 py-3 font-bold text-white disabled:bg-slate-400">{isSaving ? "Saving…" : "Save review"}</button>
                      <button disabled={isSaving} onClick={() => void updateStatus(loan.id, "Pending")} className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-white disabled:bg-slate-400">Pending</button>
                      <button disabled={isSaving} onClick={() => void updateStatus(loan.id, "Approved")} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:bg-slate-400">Approve loan</button>
                      <button disabled={isSaving} onClick={() => void updateStatus(loan.id, "Denied")} className="rounded-xl bg-rose-600 px-5 py-3 font-bold text-white disabled:bg-slate-400">Deny</button>
                      <button disabled={isSaving} onClick={() => void updateStatus(loan.id, "Funded")} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-slate-400">Mark funded</button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </AppLayout>
  );
}
