import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

interface Message {
  id: string;
  sender_id: string;
  recipient_id?: string | null;
  sender_role: string;
  body: string;
  created_at: string;
  loan_application_id: string | number | null;
  read: boolean;
}

interface Thread {
  loan_application_id: string;
  loan_name: string;
  last_message: string;
  unread: number;
  updated_at: string;
}

interface Counteroffer {
  id: string | number;
  loan_application_id: string | number;
  borrower_user_id?: string | null;
  original_loan_amount: number | string;
  proposed_loan_amount: number | string;
  land_value?: number | string | null;
  resulting_ltv_percent?: number | string | null;
  borrower_interest_rate?: number | string | null;
  repayment_term_months?: number | string | null;
  estimated_monthly_payment?: number | string | null;
  explanation?: string | null;
  status: string;
  sent_at?: string | null;
}

function money(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function errorText(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function MessageCenter() {
  const { addToast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [counteroffer, setCounteroffer] = useState<Counteroffer | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const otherParticipantId = useMemo(() => {
    const participant = messages.find(
      (message) => message.sender_id !== userId || message.recipient_id !== userId,
    );
    if (!participant) return null;
    if (participant.sender_id !== userId) return participant.sender_id;
    return participant.recipient_id ?? null;
  }, [messages, userId]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const role = String(
        user.user_metadata?.role || user.app_metadata?.role || "borrower",
      ).toLowerCase();
      setUserRole(role);
      void loadThreads(user.id);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, counteroffer]);

  useEffect(() => {
    if (!supabase || !activeThread) return;

    const channel = supabase
      .channel(`messages:${activeThread}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `loan_application_id=eq.${activeThread}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((previous) =>
            previous.some((message) => message.id === incoming.id)
              ? previous
              : [...previous, incoming],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [activeThread]);

  async function loadThreads(uid: string) {
    if (!supabase) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("messages")
      .select("loan_application_id, body, created_at, read, sender_id")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (error) {
      addToast("error", "Unable to load messages", error.message);
      setLoading(false);
      return;
    }

    const threadMap = new Map<string, Thread>();
    for (const message of (data ?? []) as Array<Record<string, any>>) {
      const loanId = String(message.loan_application_id ?? "");
      if (!threadMap.has(loanId)) {
        threadMap.set(loanId, {
          loan_application_id: loanId,
          loan_name: loanId ? `Loan #${loanId}` : "General",
          last_message: String(message.body ?? ""),
          unread: !message.read && message.sender_id !== uid ? 1 : 0,
          updated_at: String(message.created_at),
        });
      } else {
        const thread = threadMap.get(loanId)!;
        if (!message.read && message.sender_id !== uid) thread.unread += 1;
      }
    }

    setThreads(Array.from(threadMap.values()));
    setLoading(false);
  }

  async function loadCounteroffer(loanId: string) {
    if (!supabase || userRole !== "borrower") {
      setCounteroffer(null);
      return;
    }

    const { data, error } = await supabase
      .from("loan_counteroffers")
      .select("*")
      .eq("loan_application_id", Number(loanId))
      .eq("borrower_user_id", userId)
      .eq("status", "pending")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Counteroffer load failed:", error);
      setCounteroffer(null);
      return;
    }

    setCounteroffer((data as Counteroffer | null) ?? null);
  }

  async function openThread(loanId: string) {
    if (!supabase) return;
    setActiveThread(loanId);
    setMessages([]);
    setCounteroffer(null);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("loan_application_id", Number(loanId))
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    if (error) {
      addToast("error", "Unable to open conversation", error.message);
      return;
    }

    setMessages((data as Message[] | null) ?? []);

    await supabase
      .from("messages")
      .update({ read: true })
      .eq("loan_application_id", Number(loanId))
      .eq("recipient_id", userId)
      .neq("sender_id", userId);

    await loadCounteroffer(loanId);
  }

  async function send() {
    if (!body.trim() || !activeThread || !supabase) return;

    const recipientId = otherParticipantId;
    if (!recipientId) {
      addToast(
        "error",
        "Unable to send message",
        "The other participant could not be identified for this conversation.",
      );
      return;
    }

    setSending(true);

    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      recipient_id: recipientId,
      sender_role: userRole,
      loan_application_id: Number(activeThread),
      body: body.trim(),
      read: false,
    });

    if (error) {
      addToast("error", "Failed to send message", error.message);
    } else {
      setBody("");
      await loadThreads(userId);
    }
    setSending(false);
  }

  async function respondToCounteroffer(accepted: boolean) {
    if (!supabase || !counteroffer || !activeThread) return;
    setResponding(true);

    try {
      const { error } = await supabase.rpc("respond_to_loan_counteroffer", {
        p_counteroffer_id: Number(counteroffer.id),
        p_accept: accepted,
      });

      if (error) throw error;

      addToast(
        "success",
        accepted ? "Offer accepted" : "Offer declined",
        accepted
          ? "The administrator has been notified."
          : "The administrator has been notified of your decision.",
      );

      setCounteroffer(null);
      await openThread(activeThread);
      await loadThreads(userId);
    } catch (error: unknown) {
      console.error("Counteroffer response failed:", error);
      addToast(
        "error",
        "Unable to record your response",
        errorText(error, "Please try again."),
      );
    } finally {
      setResponding(false);
    }
  }

  function timeLabel(value: string) {
    const date = new Date(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString();
  }

  return (
    <div className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm md:h-[680px] md:flex-row">
      <aside className="max-h-56 w-full flex-shrink-0 overflow-y-auto border-b border-slate-700 bg-slate-900 md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-bold text-white">Messages</h3>
        </div>
        {loading ? (
          <p className="p-4 text-xs text-slate-400">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="p-4 text-xs text-slate-400">No conversations yet.</p>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.loan_application_id}
              type="button"
              onClick={() => void openThread(thread.loan_application_id)}
              className={`block w-full border-l-2 px-4 py-3 text-left transition hover:bg-slate-800 ${
                activeThread === thread.loan_application_id
                  ? "border-emerald-500 bg-slate-800"
                  : "border-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-white">
                  {thread.loan_name}
                </p>
                {thread.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">
                    {thread.unread}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {thread.last_message}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {timeLabel(thread.updated_at)}
              </p>
            </button>
          ))
        )}
      </aside>

      <div className="flex min-h-[460px] flex-1 flex-col">
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-10 w-10"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="mt-2 text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {counteroffer && (
                <section className="rounded-2xl border border-blue-400 bg-blue-950/70 p-5 text-white shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
                        Action required
                      </p>
                      <h3 className="mt-1 text-xl font-black">Revised loan offer</h3>
                    </div>
                    <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">
                      Awaiting your response
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-xl bg-slate-950/50 p-4 sm:grid-cols-2">
                    <p><span className="text-slate-400">Original request:</span><br /><strong>{money(counteroffer.original_loan_amount)}</strong></p>
                    <p><span className="text-slate-400">Revised offer:</span><br /><strong>{money(counteroffer.proposed_loan_amount)}</strong></p>
                    <p><span className="text-slate-400">Resulting LTV:</span><br /><strong>{Number(counteroffer.resulting_ltv_percent || 0).toFixed(2)}%</strong></p>
                    <p><span className="text-slate-400">Estimated payment:</span><br /><strong>{money(counteroffer.estimated_monthly_payment)}</strong></p>
                    <p><span className="text-slate-400">Interest rate:</span><br /><strong>{Number(counteroffer.borrower_interest_rate || 0).toFixed(2)}%</strong></p>
                    <p><span className="text-slate-400">Term:</span><br /><strong>{Number(counteroffer.repayment_term_months || 0)} months</strong></p>
                  </div>

                  {counteroffer.explanation && (
                    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Administrator explanation</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{counteroffer.explanation}</p>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void respondToCounteroffer(true)}
                      disabled={responding}
                      className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-50"
                    >
                      {responding ? "Saving…" : "Accept Revised Offer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondToCounteroffer(false)}
                      disabled={responding}
                      className="rounded-xl bg-rose-600 px-4 py-3 font-black text-white disabled:opacity-50"
                    >
                      Decline Offer
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-blue-200">
                    Use the message box below to ask the administrator a question before responding.
                  </p>
                </section>
              )}

              {messages.map((message) => {
                const isMine = message.sender_id === userId;
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                        isMine
                          ? "rounded-br-sm bg-emerald-600 text-white"
                          : "rounded-bl-sm bg-slate-800 text-slate-100"
                      }`}
                    >
                      {message.body}
                    </div>
                    <span className="mt-1 text-[10px] text-slate-500">
                      {isMine ? "You" : message.sender_role} · {timeLabel(message.created_at)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-700 bg-slate-900 p-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-900"
                />
                <button
                  type="submit"
                  disabled={!body.trim() || sending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
