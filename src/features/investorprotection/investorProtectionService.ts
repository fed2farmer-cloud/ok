import { supabase } from "../../lib/supabase";

export type InvestmentStatus =
  | "protection_period"
  | "refund_requested"
  | "refund_processing"
  | "refunded"
  | "settled"
  | "active"
  | "cancelled"
  | "failed";

export interface PortfolioInvestment {
  id: number;
  loan_id: number;
  investor_id: string;
  amount: number;
  status: InvestmentStatus;
  created_at: string;
  refund_policy_enabled: boolean;
  refund_period_days: number;
  refund_deadline: string | null;
  refunded_at: string | null;
  settled_at: string | null;
}

export function getRefundCountdown(deadline: string | null) {
  if (!deadline) return { eligible: false, label: "Not refundable" };

  const milliseconds = new Date(deadline).getTime() - Date.now();

  if (milliseconds <= 0) {
    return { eligible: false, label: "Refund period expired" };
  }

  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return {
    eligible: true,
    label: `${days}d ${hours}h ${minutes}m remaining`,
  };
}

export async function investFromWallet(
  publicLoanNumber: number,
  amount: number
) {
  const { data, error } = await supabase.rpc("invest_from_wallet_v28", {
    p_loan_number: publicLoanNumber,
    p_amount: amount,
  });

  if (error) throw error;
  return data;
}

export async function loadMyPortfolio(): Promise<PortfolioInvestment[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("You must be signed in.");

  const { data, error } = await supabase
    .from("investments")
    .select(
      "id,loan_id,investor_id,amount,status,created_at,refund_policy_enabled,refund_period_days,refund_deadline,refunded_at,settled_at"
    )
    .eq("investor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PortfolioInvestment[];
}

export async function requestPortfolioRefund(
  investmentId: number,
  reason = ""
) {
  const { data, error } = await supabase.rpc(
    "request_investment_refund_v28",
    {
      p_investment_id: investmentId,
      p_reason: reason || null,
    }
  );

  if (error) throw error;
  return data;
}
