import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";

interface Message {
  id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  created_at: string;
  loan_application_id: string | null;
  read: boolean;
}

interface Thread {
  loan_application_id: string;
  loan_name: string;
  last_message: string;
  unread: number;
  updated_at: string;
}

export default function MessageCenter() {
  const { addToast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const r = String(user.user_metadata?.role || user.app_metadata?.role || "borrower").toLowerCase();
      setUserRole(r);
      loadThreads(user.id);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !activeThread) return;

    const channel = supabase
      .channel(`messages:${activeThread}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `loan_application_id=eq.${activeThread}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [activeThread]);

  async function loadThreads(uid: string) {
    if (!supabase) return;
    setLoading(true);

    const { data } = await supabase
      .from("messages")
      .select("loan_application_id, body, created_at, read, sender_id")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    // Group into threads
    const threadMap = new Map<string, Thread>();
    for (const m of (data ?? []) as any[]) {
      const lid = String(m.loan_application_id ?? "");
      if (!threadMap.has(lid)) {
        threadMap.set(lid, {
          loan_application_id: lid,
          loan_name: lid ? `Loan #${lid}` : "General",
          last_message: m.body,
          unread: (!m.read && m.sender_id !== uid) ? 1 : 0,
          updated_at: m.created_at,
        });
      } else {
        const t = threadMap.get(lid)!;
        if (!m.read && m.sender_id !== uid) t.unread++;
      }
    }
    setThreads(Array.from(threadMap.values()));
    setLoading(false);
  }

  async function openThread(loanId: string) {
    if (!supabase) return;
    setActiveThread(loanId);
    setMessages([]);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("loan_application_id", loanId)
      .order("created_at", { ascending: true });

    setMessages((data as Message[] | null) ?? []);

    // Mark received messages as read
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("loan_application_id", loanId)
      .neq("sender_id", userId);
  }

  async function send() {
    if (!body.trim() || !activeThread || !supabase) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      sender_role: userRole,
      loan_application_id: activeThread,
      body: body.trim(),
      read: false,
    });

    if (error) {
      addToast("error", "Failed to send message", error.message);
    } else {
      setBody("");
    }
    setSending(false);
  }

  function timeLabel(v: string) {
    const d = new Date(v);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Thread list */}
      <aside className="w-64 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Messages</h3>
        </div>
        {loading ? (
          <p className="p-4 text-xs text-slate-400">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="p-4 text-xs text-slate-400">No conversations yet.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.loan_application_id}
              type="button"
              onClick={() => openThread(t.loan_application_id)}
              className={`block w-full px-4 py-3 text-left transition hover:bg-white ${activeThread === t.loan_application_id ? "bg-white border-l-2 border-emerald-500" : "border-l-2 border-transparent"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-800">{t.loan_name}</p>
                {t.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">
                    {t.unread}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{t.last_message}</p>
              <p className="mt-1 text-[10px] text-slate-400">{timeLabel(t.updated_at)}</p>
            </button>
          ))
        )}
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="mt-2 text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const isMine = m.sender_id === userId;
                return (
                  <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMine ? "bg-emerald-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-900 rounded-bl-sm"}`}>
                      {m.body}
                    </div>
                    <span className="mt-1 text-[10px] text-slate-400">
                      {isMine ? "You" : m.sender_role} · {timeLabel(m.created_at)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-slate-200 p-3">
              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
