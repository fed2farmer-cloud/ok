import { supabase } from "../../lib/supabase";

export type InvestmentStatus =
  | "payment_pending"
  | "protection_period"
  | "refund_requested"
  | "refund_processing"
  | "refunded"
  | "settled"
  | "active"
  | "cancelled"
  | "failed";

export interface ProtectedInvestment {
  id: string;
  investor_user_id: string;
  loan_application_id: number;
  amount: number;
  status: InvestmentStatus;
  invested_at: string;
  refund_policy_enabled: boolean;
  refund_period_days: number;
  refund_deadline: string | null;
}

export function getProtectionTime(deadline: string | null) {
  if (!deadline) return { eligible: false, label: "Not protected" };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { eligible: false, label: "Protection expired" };
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { eligible: true, label: `${days}d ${hours}h ${minutes}m remaining` };
}

export async function loadMyProtectedInvestments(): Promise<ProtectedInvestment[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("You must be signed in.");

  const { data, error } = await supabase
    .from("investments")
    .select("id,investor_user_id,loan_application_id,amount,status,invested_at,refund_policy_enabled,refund_period_days,refund_deadline")
    .eq("investor_user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProtectedInvestment[];
}

export async function createProtectedInvestment(loanApplicationId: number, amount: number) {
  const { data, error } = await supabase.rpc("create_protected_investment", {
    p_loan_application_id: loanApplicationId,
    p_amount: amount,
  });
  if (error) throw error;
  return data;
}

export async function requestInvestmentRefund(investmentId: string, reason = "") {
  const { data, error } = await supabase.rpc("request_investment_refund", {
    p_investment_id: investmentId,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data;
}
