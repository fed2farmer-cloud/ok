export type FundingDisplay = {
  goal: number;
  funded: number;
  remaining: number;
  percent: number;
  isFullyFunded: boolean;
  isExpired: boolean;
  label: string;
};

const TERMINAL_APPLICATION_STATUSES = new Set([
  "pending",
  "denied",
  "rejected",
  "cancelled",
  "canceled",
  "disbursed",
  "active",
  "completed",
  "defaulted",
  "paid_off",
  "paid off",
  "closed",
]);

/**
 * Returns the funding label from actual dollars committed versus the funding goal.
 * A stored `Funded` label is never trusted when the committed amount is below goal.
 */
export function deriveFundingDisplay({
  goal,
  funded,
  deadline,
  fallbackStatus,
}: {
  goal?: number | null;
  funded?: number | null;
  deadline?: string | null;
  fallbackStatus?: string | null;
}): FundingDisplay {
  const safeGoal = Math.max(Number(goal || 0), 0);
  const safeFunded = Math.max(Number(funded || 0), 0);
  const remaining = Math.max(safeGoal - safeFunded, 0);
  const percent = safeGoal > 0 ? Math.min(100, Math.max(0, (safeFunded / safeGoal) * 100)) : 0;
  const isFullyFunded = safeGoal > 0 && remaining <= 0.009;
  const deadlineMs = deadline ? new Date(deadline).getTime() : Number.NaN;
  const isExpired = Number.isFinite(deadlineMs) && deadlineMs <= Date.now();
  const normalized = String(fallbackStatus || "").trim().toLowerCase();

  if (TERMINAL_APPLICATION_STATUSES.has(normalized)) {
    return {
      goal: safeGoal,
      funded: safeFunded,
      remaining,
      percent,
      isFullyFunded,
      isExpired,
      label: fallbackStatus || "Closed",
    };
  }

  if (isFullyFunded) {
    return { goal: safeGoal, funded: safeFunded, remaining, percent, isFullyFunded, isExpired, label: "Fully Funded" };
  }

  if (isExpired && safeGoal > 0) {
    return { goal: safeGoal, funded: safeFunded, remaining, percent, isFullyFunded, isExpired, label: "Funding Closed — Underfunded" };
  }

  if (["approved", "funded", "open", "published", "funding"].includes(normalized) || safeGoal > 0) {
    return { goal: safeGoal, funded: safeFunded, remaining, percent, isFullyFunded, isExpired, label: "Funding" };
  }

  return {
    goal: safeGoal,
    funded: safeFunded,
    remaining,
    percent,
    isFullyFunded,
    isExpired,
    label: fallbackStatus || "Not Started",
  };
}
