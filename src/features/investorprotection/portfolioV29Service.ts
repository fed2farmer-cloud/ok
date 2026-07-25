import { supabase } from "../../lib/supabase";

export type PortfolioRow = {
  investment_id: number;
  investor_id: string;
  internal_loan_id: number;
  public_loan_number: number;
  business_name: string;
  amount: number;
  investor_interest_rate: number | null;
  term_months: number | null;
  status: string;
  display_status: string;
  created_at: string;
  refund_policy_enabled: boolean;
  refund_period_days: number;
  protection_expires_at: string | null;
  refund_eligible: boolean;
};

export function getProtectionCountdown(expiresAt: string | null) {
  if (!expiresAt) return { active: false, label: "No protection period" };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { active: false, label: "Protection period expired" };
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { active: true, label: `${days}d ${hours}h ${minutes}m remaining` };
}

export async function loadInvestorPortfolioV29(): Promise<PortfolioRow[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("You must be signed in.");
  const { data, error } = await supabase.from("investor_portfolio_v29").select("*").eq("investor_id", auth.user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioRow[];
}

export async function requestRefundV29(investmentId: number, reason = "") {
  const { data, error } = await supabase.rpc("request_investment_refund_v28", { p_investment_id: investmentId, p_reason: reason || null });
  if (error) throw error;
  return data;
}
