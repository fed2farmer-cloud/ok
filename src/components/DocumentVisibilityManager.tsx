export type DocumentVisibility = "private" | "investor_safe" | "public_summary";

export default function DocumentVisibilityManager({
  value,
  hasRedactedCopy,
  onChange,
}: {
  value: DocumentVisibility;
  hasRedactedCopy?: boolean;
  onChange: (value: DocumentVisibility) => void;
}) {
  const options: Array<{ value: DocumentVisibility; label: string; description: string }> = [
    { value: "private", label: "🔒 Private", description: "Borrower and authorized administrators only." },
    { value: "investor_safe", label: "👥 Investor Safe", description: "Requires a separately reviewed redacted copy." },
    { value: "public_summary", label: "🌍 Public Summary", description: "Non-sensitive summary information only." },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-black text-slate-900">Document visibility</p>
      <div className="mt-3 grid gap-2">
        {options.map((option) => {
          const disabled = option.value === "investor_safe" && !hasRedactedCopy;
          return (
            <label key={option.value} className={`flex gap-3 rounded-lg border p-3 ${value === option.value ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"} ${disabled ? "opacity-50" : "cursor-pointer"}`}>
              <input type="radio" name="document-visibility" value={option.value} checked={value === option.value} disabled={disabled} onChange={() => onChange(option.value)} />
              <span>
                <span className="block font-bold text-slate-800">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {!hasRedactedCopy && <p className="mt-3 text-xs font-semibold text-amber-700">Investor publication is locked until a redacted copy is uploaded and approved.</p>}
    </div>
  );
}
