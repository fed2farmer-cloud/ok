import type { ReactNode } from "react";

type Props = {
  title: string;
  eyebrow?: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function AdminAccordionSection({ title, eyebrow, count, children, defaultOpen = false }: Props) {
  return (
    <details open={defaultOpen} className="group mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <div>
          {eyebrow && <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>}
          <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {typeof count === "number" && <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">{count}</span>}
          <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-xl font-black text-slate-700 transition group-open:rotate-180">⌄</span>
        </div>
      </summary>
      <div className="border-t border-slate-200 p-4 sm:p-6">{children}</div>
    </details>
  );
}
