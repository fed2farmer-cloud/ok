import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type CounterofferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

interface LoanCounteroffer {
  id: number;
  loan_application_id: string;
  borrower_user_id?: string | null;

  original_loan_amount?: number | null;
  revised_loan_amount?: number | null;

  original_interest_rate?: number | null;
  revised_interest_rate?: number | null;

  original_term_months?: number | null;
  revised_term_months?: number | null;

  administrator_explanation?: string | null;
  admin_explanation?: string | null;

  status: CounterofferStatus | string;
  expires_at?: string | null;
  borrower_responded_at?: string | null;
  created_at?: string | null;
}

interface LoanApplication {
  id: string;
  loan_number?: string | number | null;
  full_name?: string | null;
  business_name?: string | null;
  loan_amount?: number | null;
  borrower_interest_rate?: number | null;
  repayment_term_months?: number | null;
  status?: string | null;
}

interface OfferMessage {
  id: string | number;
  counteroffer_id: number;
  sender_user_id?: string | null;
  sender_role?: string | null;
  message: string;
  created_at?: string | null;
}

interface RpcResponse {
  success?: boolean;
  message?: string;
  status?: string;
  counteroffer_id?: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatRate(value: unknown): string {
  return `${toNumber(value).toFixed(2)}%`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export default function BorrowerOffer() {
  const navigate = useNavigate();
  const params = useParams();

  /*
   * This supports any of these routes:
   *
   * /borrower-offer/:counterofferId
   * /counteroffer/:counterofferId
   * /loan-offer/:id
   */
  const routeCounterofferId =
    params.counterofferId ??
    params.counterOfferId ??
    params.offerId ??
    params.id;

  const [counteroffer, setCounteroffer] =
    useState<LoanCounteroffer | null>(null);

  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [messages, setMessages] = useState<OfferMessage[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const explanation =
    counteroffer?.administrator_explanation ??
    counteroffer?.admin_explanation ??
    "The administrator has revised the loan terms.";

  const revisedAmount = useMemo(() => {
    return (
      counteroffer?.revised_loan_amount ??
      loan?.loan_amount ??
      counteroffer?.original_loan_amount ??
      0
    );
  }, [counteroffer, loan]);

  const revisedRate = useMemo(() => {
    return (
      counteroffer?.revised_interest_rate ??
      loan?.borrower_interest_rate ??
      counteroffer?.original_interest_rate ??
      0
    );
  }, [counteroffer, loan]);

  const revisedTerm = useMemo(() => {
    return (
      counteroffer?.revised_term_months ??
      loan?.repayment_term_months ??
      counteroffer?.original_term_months ??
      0
    );
  }, [counteroffer, loan]);

  const responseAlreadyRecorded =
    counteroffer?.status === "accepted" ||
    counteroffer?.status === "declined" ||
    Boolean(counteroffer?.borrower_responded_at);

  const offerExpired = useMemo(() => {
    if (!counteroffer?.expires_at) return false;

    const expiration = new Date(counteroffer.expires_at);

    if (Number.isNaN(expiration.getTime())) return false;

    return expiration.getTime() < Date.now();
  }, [counteroffer?.expires_at]);

  const canRespond =
    Boolean(counteroffer) &&
    !responseAlreadyRecorded &&
    !offerExpired &&
    counteroffer?.status !== "cancelled" &&
    counteroffer?.status !== "expired";

  const loadMessages = useCallback(async (counterofferId: number) => {
    /*
     * Primary table name used here:
     * loan_counteroffer_messages
     *
     * If this table does not exist, the page will still load.
     */
    const { data, error } = await supabase
      .from("loan_counteroffer_messages")
      .select(
        "id, counteroffer_id, sender_user_id, sender_role, message, created_at",
      )
      .eq("counteroffer_id", counterofferId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load counteroffer messages:", error.message);
      setMessages([]);
      return;
    }

    setMessages((data ?? []) as OfferMessage[]);
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setCurrentUserId(user.id);

      if (!routeCounterofferId) {
        throw new Error("No counteroffer ID was provided in the page URL.");
      }

      const counterofferId = Number(routeCounterofferId);

      if (!Number.isSafeInteger(counterofferId) || counterofferId <= 0) {
        throw new Error("The counteroffer ID is invalid.");
      }

      const { data: offerData, error: offerError } = await supabase
        .from("loan_counteroffers")
        .select("*")
        .eq("id", counterofferId)
        .single();

      if (offerError) {
        throw offerError;
      }

      if (!offerData) {
        throw new Error("The revised loan offer could not be found.");
      }

      const loadedOffer = offerData as LoanCounteroffer;

      setCounteroffer(loadedOffer);

      if (loadedOffer.loan_application_id) {
        const { data: loanData, error: loanError } = await supabase
          .from("loan_applications")
          .select(
            `
              id,
              loan_number,
              full_name,
              business_name,
              loan_amount,
              borrower_interest_rate,
              repayment_term_months,
              status
            `,
          )
          .eq("id", loadedOffer.loan_application_id)
          .single();

        if (loanError) {
          console.warn(
            "The counteroffer loaded, but the loan could not be loaded:",
            loanError.message,
          );
        } else {
          setLoan(loanData as LoanApplication);
        }
      }

      await loadMessages(counterofferId);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadMessages, navigate, routeCounterofferId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function respondToCounteroffer(accept: boolean) {
    if (!counteroffer) return;

    if (!canRespond) {
      setPageError("This revised offer can no longer be accepted or declined.");
      return;
    }

    const confirmationMessage = accept
      ? "Accept the revised loan offer?"
      : "Decline the revised loan offer?";

    const confirmed = window.confirm(confirmationMessage);

    if (!confirmed) return;

    setResponding(true);
    setPageError("");
    setSuccessMessage("");

    try {
      /*
       * IMPORTANT:
       *
       * Your PostgreSQL function currently accepts exactly:
       *
       * p_counteroffer_id bigint
       * p_accept boolean
       *
       * Do not add p_agreement_version or p_user_agent here unless the SQL
       * function is changed to accept those parameters.
       */
      const { data, error } = await supabase.rpc(
        "respond_to_loan_counteroffer",
        {
          p_counteroffer_id: Number(counteroffer.id),
          p_accept: accept,
        },
      );

      if (error) {
        throw error;
      }

      const rpcResult = data as RpcResponse | RpcResponse[] | null;

      const normalizedResult = Array.isArray(rpcResult)
        ? rpcResult[0]
        : rpcResult;

      if (normalizedResult?.success === false) {
        throw new Error(
          normalizedResult.message ?? "The response could not be recorded.",
        );
      }

      setCounteroffer((previous) =>
        previous
          ? {
              ...previous,
              status: accept ? "accepted" : "declined",
              borrower_responded_at: new Date().toISOString(),
            }
          : previous,
      );

      setSuccessMessage(
        accept
          ? "You accepted the revised loan offer."
          : "You declined the revised loan offer.",
      );

      /*
       * Reload from Supabase so the page reflects all database changes made
       * by the RPC function.
       */
      window.setTimeout(() => {
        void loadPage();
      }, 600);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setResponding(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!counteroffer || !currentUserId) return;

    const trimmedMessage = messageText.trim();

    if (!trimmedMessage) {
      setPageError("Enter a message before pressing Send.");
      return;
    }

    setSendingMessage(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("loan_counteroffer_messages")
        .insert({
          counteroffer_id: counteroffer.id,
          loan_application_id: counteroffer.loan_application_id,
          sender_user_id: currentUserId,
          sender_role: "borrower",
          message: trimmedMessage,
        });

      if (error) {
        throw error;
      }

      setMessageText("");
      setSuccessMessage("Your message was sent to the administrator.");

      await loadMessages(counteroffer.id);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSendingMessage(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-blue-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-300 border-t-transparent" />

          <p className="mt-4 text-lg text-slate-300">
            Loading your revised loan offer...
          </p>
        </div>
      </main>
    );
  }

  if (!counteroffer) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-800 bg-slate-900 p-8 shadow-2xl">
          <h1 className="text-2xl font-black">Offer unavailable</h1>

          <p className="mt-4 text-red-200">
            {pageError || "The revised loan offer could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-bold hover:bg-blue-500"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-16 text-white">
      <section className="border-b border-slate-800 bg-slate-950 px-4 py-7">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              SecuredLanding
            </p>

            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              Revised Loan Offer
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-slate-600 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-800"
          >
            Dashboard
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {pageError && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-600 bg-red-950/80 p-5 text-red-100"
          >
            <p className="font-black">Unable to complete the request</p>
            <p className="mt-1 break-words text-sm">{pageError}</p>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-emerald-600 bg-emerald-950/80 p-5 text-emerald-100"
          >
            <p className="font-black">Response recorded</p>
            <p className="mt-1 text-sm">{successMessage}</p>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-blue-700 bg-blue-950/70 shadow-2xl">
          <div className="border-b border-blue-800 bg-gradient-to-r from-blue-950 to-slate-900 p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-300">
              Loan application
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              {loan?.business_name ||
                loan?.full_name ||
                "Your loan application"}
            </h2>

            {loan?.loan_number && (
              <p className="mt-2 text-slate-300">
                Loan #{String(loan.loan_number)}
              </p>
            )}
          </div>

          <div className="p-5 sm:p-8">
            <div className="rounded-3xl border border-blue-900 bg-slate-950/50 p-6">
              <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Revised terms
              </p>

              <dl className="mt-6 grid gap-6 sm:grid-cols-3">
                <div>
                  <dt className="text-lg text-slate-400">Loan amount</dt>
                  <dd className="mt-1 text-2xl font-black">
                    {formatMoney(revisedAmount)}
                  </dd>
                </div>

                <div>
                  <dt className="text-lg text-slate-400">Interest rate</dt>
                  <dd className="mt-1 text-2xl font-black">
                    {formatRate(revisedRate)}
                  </dd>
                </div>

                <div>
                  <dt className="