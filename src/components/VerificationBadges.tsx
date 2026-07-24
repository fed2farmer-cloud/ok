type Props = {
  hasApprovedPhotos: boolean;
  hasApprovedVideo: boolean;
  hasLandValue: boolean;
  riskScore?: string | null;
};

export default function VerificationBadges({ hasApprovedPhotos, hasApprovedVideo, hasLandValue, riskScore }: Props) {
  const badges = [
    { label: "Marketplace reviewed", show: true },
    { label: "Property media reviewed", show: hasApprovedPhotos },
    { label: "Borrower video reviewed", show: hasApprovedVideo },
    { label: "Land value provided", show: hasLandValue },
    { label: `Risk: ${riskScore}`, show: Boolean(riskScore) },
  ].filter((badge) => badge.show);

  return (
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Opportunity review indicators">
      {badges.map((badge) => (
        <span key={badge.label} className="rounded-full border border-emerald-700/60 bg-emerald-950/50 px-3 py-1.5 text-xs font-bold text-emerald-200">
          ✓ {badge.label}
        </span>
      ))}
    </div>
  );
}
