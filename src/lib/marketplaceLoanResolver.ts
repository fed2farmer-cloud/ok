import { supabase } from "./supabase";

export type MarketplaceLoanMatch = {
  id: string;
  loan_application_id: number;
  loan_number: number | null;
  funding_goal: number | null;
  loan_amount: number | null;
  amount_funded: number | null;
  amount_remaining: number | null;
  status: string | null;
};

function numericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Resolves either the internal loan_applications.id OR the public six-digit
 * loan_number to the canonical marketplace_loans row.
 */
export async function resolveMarketplaceLoan(
  loanReference: unknown
): Promise<MarketplaceLoanMatch> {
  const ref = numericId(loanReference);
  if (ref === null) throw new Error("Invalid loan reference.");

  // Preferred: payment routes should pass loan_application_id.
  const byApplication = await supabase
    .from("marketplace_loans")
    .select("id,loan_application_id,loan_number,funding_goal,loan_amount,amount_funded,amount_remaining,status")
    .eq("loan_application_id", ref)
    .maybeSingle();

  if (byApplication.error) throw byApplication.error;
  if (byApplication.data) return byApplication.data as MarketplaceLoanMatch;

  // Backward-compatible fallback: older routes pass the visible six-digit loan number.
  const byNumber = await supabase
    .from("marketplace_loans")
    .select("id,loan_application_id,loan_number,funding_goal,loan_amount,amount_funded,amount_remaining,status")
    .eq("loan_number", ref)
    .maybeSingle();

  if (byNumber.error) throw byNumber.error;
  if (byNumber.data) return byNumber.data as MarketplaceLoanMatch;

  // Last recovery path: resolve public number through loan_applications.
  const application = await supabase
    .from("loan_applications")
    .select("id,loan_number")
    .eq("loan_number", ref)
    .maybeSingle();

  if (application.error) throw application.error;

  if (application.data?.id != null) {
    const recovered = await supabase
      .from("marketplace_loans")
      .select("id,loan_application_id,loan_number,funding_goal,loan_amount,amount_funded,amount_remaining,status")
      .eq("loan_application_id", application.data.id)
      .maybeSingle();

    if (recovered.error) throw recovered.error;
    if (recovered.data) return recovered.data as MarketplaceLoanMatch;
  }

  throw new Error(
    `Marketplace loan not found for reference ${String(loanReference)}. ` +
    "Do not save another investment until this loan is published to marketplace_loans."
  );
}

export async function updateMarketplaceFunding(
  loanReference: unknown,
  investmentAmount: number
) {
  if (!Number.isFinite(investmentAmount) || investmentAmount <= 0) {
    throw new Error("Investment amount must be greater than zero.");
  }

  const loan = await resolveMarketplaceLoan(loanReference);
  const goal = Number(loan.funding_goal ?? loan.loan_amount ?? 0);
  const oldFunded = Number(loan.amount_funded ?? 0);
  const oldRemaining = Number(
    loan.amount_remaining ?? Math.max(goal - oldFunded, 0)
  );

  if (investmentAmount > oldRemaining) {
    throw new Error(
      `Investment exceeds the remaining loan balance of $${oldRemaining.toFixed(2)}.`
    );
  }

  const amountFunded = oldFunded + investmentAmount;
  const amountRemaining = Math.max(goal - amountFunded, 0);
  const status = amountRemaining <= 0 ? "Funded" : "Open";

  const { data, error } = await supabase
    .from("marketplace_loans")
    .update({
      amount_funded: amountFunded,
      amount_remaining: amountRemaining,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loan.id)
    .select("id,loan_application_id,loan_number,amount_funded,amount_remaining,status")
    .single();

  if (error) throw error;
  return data;
}
