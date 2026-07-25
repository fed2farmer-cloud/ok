type SignatureStatusBadgeProps = {
  status?: string | null;
};

export default function SignatureStatusBadge({
  status,
}: SignatureStatusBadgeProps) {
  const normalized = String(status || "not_required").toLowerCase();

  const className =
    normalized === "signed"
      ? "border-emerald-600 bg-emerald-950 text-emerald-300"
      : normalized === "ready_for_signature" ||
          normalized === "partially_signed"
        ? "border-amber-600 bg-amber-950 text-amber-200"
        : normalized === "declined" || normalized === "voided"
          ? "border-rose-600 bg-rose-950 text-rose-200"
          : "border-slate-600 bg-slate-900 text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${className}`}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}
