import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMITTED_INVESTMENT_STATUSES = new Set([
  "active",
  "settled",
  "funded",
  "completed",
  "protection_period",
  "refund_requested",
  "refund_processing",
]);

export type CanonicalOwnedInvestment = Record<string, any> & {
  current_principal: number;
  original_principal: number;
  has_active_position: boolean;
};

export type InvestorPortfolioSnapshot = {
  investments: CanonicalOwnedInvestment[];
  investedBalance: number;
};

/**
 * Load one canonical ownership snapshot for every investor-facing page.
 *
 * Ownership rules:
 * - current_owner_id wins after a secondary-market transfer.
 * - investor_id is used only while current_owner_id is null.
 * - terminal/refunded rows are excluded from invested capital.
 * - investor_positions.current_principal wins when present so repayments reduce
 *   the displayed invested principal; legacy/missing positions fall back to the
 *   investment amount instead of hiding the certificate.
 */
export async function loadOwnedInvestorPortfolio(
  client: SupabaseClient<any, any, any>,
  userId: string,
): Promise<InvestorPortfolioSnapshot> {
  const { data: investmentRows, error: investmentsError } = await client
    .from("investments")
    .select("*")
    .or(
      `current_owner_id.eq.${userId},and(current_owner_id.is.null,investor_id.eq.${userId})`,
    )
    .order("created_at", { ascending: false });

  if (investmentsError) throw investmentsError;

  const owned = (investmentRows || []).filter((investment: any) =>
    COMMITTED_INVESTMENT_STATUSES.has(
      String(investment.status || "").toLowerCase(),
    ),
  );

  const investmentIds = owned
    .map((investment: any) => investment.id)
    .filter((id: unknown) => id !== null && id !== undefined);

  let positionByInvestmentId = new Map<string, any>();

  if (investmentIds.length > 0) {
    const { data: positionRows, error: positionError } = await client
      .from("investor_positions")
      .select("investment_id,original_principal,current_principal,status")
      .in("investment_id", investmentIds)
      .eq("investor_user_id", userId)
      .eq("status", "active");

    // Position rows are a servicing projection. A temporary read-policy or
    // migration issue must not make owned investments disappear from the UI.
    if (!positionError) {
      positionByInvestmentId = new Map(
        (positionRows || []).map((position: any) => [
          String(position.investment_id),
          position,
        ]),
      );
    } else {
      console.warn(
        "Unable to load investor positions; using investment principal fallback:",
        positionError.message,
      );
    }
  }

  const investments = owned.map((investment: any) => {
    const position = positionByInvestmentId.get(String(investment.id));
    return {
      ...investment,
      original_principal: Number(
        position?.original_principal ?? investment.amount ?? 0,
      ),
      current_principal: Number(
        position?.current_principal ?? investment.amount ?? 0,
      ),
      has_active_position: Boolean(position),
    } as CanonicalOwnedInvestment;
  });

  const investedBalance = investments.reduce(
    (sum, investment) => sum + Number(investment.current_principal || 0),
    0,
  );

  return { investments, investedBalance };
}
