type ClosingTask = {
  id: string | number;
  title: string;
  status?: string | null;
};

export default function ClosingChecklist({ tasks }: { tasks: ClosingTask[] }) {
  const normalized = tasks.length
    ? tasks
    : [
        { id: "approved", title: "Underwriting approved", status: "complete" },
        { id: "documents", title: "Review closing documents", status: "pending" },
        { id: "signatures", title: "Complete borrower acknowledgements", status: "pending" },
        { id: "funding", title: "45-day investor funding window", status: "pending" },
        { id: "disbursement", title: "Final review and disbursement", status: "pending" },
      ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Closing checklist</p>
      <div className="mt-4 space-y-3">
        {normalized.map((task) => {
          const status = String(task.status || "pending").toLowerCase();
          const complete = ["complete", "completed", "accepted", "signed"].includes(status);
          const active = ["submitted", "ready_for_review", "viewed", "in_progress"].includes(status);
          return (
            <div key={String(task.id)} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${complete ? "bg-emerald-600 text-white" : active ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-600"}`}>
                {complete ? "✓" : active ? "•" : "○"}
              </span>
              <div>
                <p className="font-bold text-slate-800">{task.title}</p>
                <p className="text-xs capitalize text-slate-500">{status.replaceAll("_", " ")}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
