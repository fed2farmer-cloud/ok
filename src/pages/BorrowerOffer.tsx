import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Counteroffer = {
  id: number;
  loan_application_id: string;
  original_loan_amount?: number | null;
  revised_loan_amount?: number | null;
  original_interest_rate?: number | null;
  revised_interest_rate?: number | null;
  original_term_months?: number | null;
  revised_term_months?: number | null;
  administrator_explanation?: string | null;
  admin_explanation?: string | null;
  status?: string | null;
  expires_at?: string | null;
  borrower_responded_at?: string | null;
};

type LoanApplication = {
  id: string;
  loan_number?: string | number | null;
  full_name?: string | null;
  business_name?: string | null;
  loan_amount?: number | null;
  borrower_interest_rate?: number | null;
  repayment_term_months?: number | null;
};

type OfferMessage = {
  id: string | number;
  counteroffer_id: number;
  sender_user_id?: string | null;
  sender_role?: string | null;
  message: string;
  created_at?: string | null;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "An unexpected error occurred.";
}

function money(value: unknown): string {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function rate(value: unknown): string {
  const amount = Number(value ?? 0);
  return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}%`;
}

function dateTime(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function BorrowerOffer() {
  const navigate = useNavigate();
  const params = useParams();

  const routeId =
    params.counterofferId ??
    params.counterOfferId ??
    params.offerId ??
    params.id;

  const [offer, setOffer] = useState<Counteroffer | null>(null);
  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [messages, setMessages] = useState<OfferMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");

  const amount =
    offer?.revised_loan_amount ??
    loan?.loan_amount ??
    offer?.original_loan_amount ??
    0;

  const interest =
    offer?.revised_interest_rate ??
    loan?.borrower_interest_rate ??
    offer?.original_interest_rate ??
    0;

  const term =
    offer?.revised_term_months ??
    loan?.repayment_term_months ??
    offer?.original_term_months ??
    0;

  const explanation =
    offer?.administrator_explanation ??
    offer?.admin_explanation ??
    "The administrator revised the requested loan terms.";

  const expired = useMemo(() => {
    if (!offer?.expires_at) return false;
    const expiresAt = new Date(offer.expires_at);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  }, [offer?.expires_at]);

  const finished =
    offer?.status === "accepted" ||
    offer?.status === "declined" ||
    Boolean(offer?.borrower_responded_at);

  const canRespond =
    Boolean(offer) &&
    !expired &&
    !finished &&
    offer?.status !== "cancelled" &&
    offer?.status !== "expired";

  const loadMessages = useCallback(async (counterofferId: number) => {
    const { data, error } = await supabase
      .from("loan_counteroffer_messages")
      .select(
        "id, counteroffer_id, sender_user_id, sender_role, message, created_at",
      )
      .eq("counteroffer_id", counterofferId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Unable to load counteroffer messages:", error.message);
      setMessages([]);
      return;
    }

    setMessages((data ?? []) as OfferMessage[]);
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUserId(user.id);

      const counterofferId = Number(routeId);

      if (!Number.isSafeInteger(counterofferId) || counterofferId <= 0) {
        throw new Error("The counteroffer link is invalid.");
      }

      const { data: offerData, error: offerError } = await supabase
        .from("loan_counteroffers")
        .select("*")
        .eq("id", counterofferId)
        .single();

      if (offerError) throw offerError;
      if (!offerData) throw new Error("The revised offer could not be found.");

      const loadedOffer = offerData as Counteroffer;
      setOffer(loadedOffer);

      if (loadedOffer.loan_application_id) {
        const { data: loanData, error: loanError } = await supabase
          .from("loan_applications")
          .select(
            "id, loan_number, full_name, business_name, loan_amount, borrower_interest_rate, repayment_term_months",
          )
          .eq("id", loadedOffer.loan_application_id)
          .single();

        if (loanError) {
          console.warn("Unable to load the related loan:", loanError.message);
        } else {
          setLoan(loanData as LoanApplication);
        }
      }

      await loadMessages(counterofferId);
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [loadMessages, navigate, routeId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function respond(accept: boolean) {
    if (!offer || !canRespond) return;

    const confirmed = window.confirm(
      accept
        ? "Accept this revised loan offer?"
        : "Decline this revised loan offer?",
    );

    if (!confirmed) return;

    setResponding(true);
    setPageError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.rpc(
        "respond_to_loan_counteroffer",
        {
          p_counteroffer_id: Number(offer.id),
          p_accept: accept,
        },
      );

      if (error) throw error;

      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        "success" in data &&
        (data as { success?: boolean }).success === false
      ) {
        throw new Error(
          String(
            (data as { message?: unknown }).message ??
              "The response could not be recorded.",
          ),
        );
      }

      setOffer((current) =>
        current
          ? {
              ...current,
              status: accept ? "accepted" : "declined",
              borrower_responded_at: new Date().toISOString(),
            }
          : current,
      );

      setSuccess(
        accept
          ? "You accepted the revised loan offer."
          : "You declined the revised loan offer.",
      );
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setResponding(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!offer || !userId || !message.trim()) return;

    setSending(true);
    setPageError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("loan_counteroffer_messages")
        .insert({
          counteroffer_id: offer.id,
          loan_application_id: offer.loan_application_id,
          sender_user_id: userId,
          sender_role: "borrower",
          message: message.trim(),
        });

      if (error) throw error;

      setMessage("");
      setSuccess("Your message was sent to the administrator.");
      await loadMessages(offer.id);
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
        <p className="mx-auto max-w-3xl text-center text-lg">
          Loading your revised offer...
        </p>
      </main>
    );
  }

  if (!offer) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
        <section className="mx-auto max-w-3xl rounded-3xl border border-red-700 bg-slate-900 p-8">
          <h1 className="text-2xl font-black">Offer unavailable</h1>
          <p className="mt-4 text-red-200">
            {pageError || "The revised offer could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold"
          >
            Return to Dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mb-5 rounded-xl border border-slate-600 px-4 py-2 font-semibold"
        >
          Back to Dashboard
        </button>

        {pageError && (
          <div className="mb-5 rounded-2xl border border-red-600 bg-red-950 p-5">
            <p className="font-black">Unable to record your response</p>
            <p className="mt-1 break-words text-sm">{pageError}</p>
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl border border-emerald-600 bg-emerald-950 p-5">
            <p className="font-black">Success</p>
            <p className="mt-1 text-sm">{success}</p>
          </div>
        )}

        <section className="rounded-3xl border border-blue-700 bg-blue-950/70 p-6 shadow-2xl sm:p-8">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-300">
            Revised loan offer
          </p>

          <h1 className="mt-2 text-3xl font-black">
            {loan?.business_name || loan?.full_name || "Your application"}
          </h1>

          {loan?.loan_number && (
            <p className="mt-2 text-slate-300">
              Loan #{String(loan.loan_number)}
            </p>
          )}

          <dl className="mt-7 grid gap-5 rounded-3xl bg-slate-950/60 p-6 sm:grid-cols-3">
            <div>
              <dt className="text-slate-400">Loan amount</dt>
              <dd className="mt-1 text-2xl font-black">{money(amount)}</dd>
            </div>

            <div>
              <dt className="text-slate-400">Interest rate</dt>
              <dd className="mt-1 text-2xl font-black">{rate(interest)}</dd>
            </div>

            <div>
              <dt className="text-slate-400">Term</dt>
              <dd className="mt-1 text-2xl font-black">
                {Number(term)} months
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-slate-600 bg-slate-900 p-6">
            <p className="text-sm font-black uppercase tracking-wider text-slate-400">
              Administrator explanation
            </p>
            <p className="mt-4 text-lg">{explanation}</p>
          </div>

          {offer.expires_at && (
            <p className="mt-4 text-sm text-slate-300">
              Offer expires: {dateTime(offer.expires_at)}
            </p>
          )}

          {expired && (
            <p className="mt-5 rounded-xl bg-amber-950 p-4 text-amber-100">
              This revised offer has expired.
            </p>
          )}

          {finished && (
            <p className="mt-5 rounded-xl bg-blue-900 p-4">
              Response recorded:{" "}
              <strong>{String(offer.status ?? "completed").toUpperCase()}</strong>
            </p>
          )}

          {canRespond && (
            <div className="mt-7 space-y-4">
              <button
                type="button"
                disabled={responding}
                onClick={() => void respond(true)}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-5 text-xl font-black disabled:opacity-60"
              >
                {responding ? "Recording Response..." : "Accept Revised Offer"}
              </button>

              <button
                type="button"
                disabled={responding}
                onClick={() => void respond(false)}
                className="w-full rounded-2xl bg-rose-600 px-5 py-5 text-xl font-black disabled:opacity-60"
              >
                {responding ? "Recording Response..." : "Decline Offer"}
              </button>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-black">Messages with Administrator</h2>

          <div className="mt-5 max-h-96 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="rounded-xl bg-slate-950 p-4 text-slate-400">
                No messages yet.
              </p>
            ) : (
              messages.map((item) => {
                const mine =
                  item.sender_user_id === userId ||
                  item.sender_role === "borrower";

                return (
                  <article
                    key={String(item.id)}
                    className={`max-w-[88%] rounded-2xl p-4 ${
                      mine ? "ml-auto bg-blue-700" : "bg-slate-950"
                    }`}
                  >
                    <p className="text-sm font-bold">
                      {mine ? "You" : "Administrator"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words">
                      {item.message}
                    </p>
                    {item.created_at && (
                      <p className="mt-2 text-xs text-slate-300">
                        {dateTime(item.created_at)}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>

          <form onSubmit={sendMessage} className="mt-5">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type a message..."
              rows={3}
              maxLength={2000}
              className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-5 py-4 text-white"
            />

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="mt-3 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-black disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
