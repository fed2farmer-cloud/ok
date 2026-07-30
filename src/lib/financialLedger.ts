import { supabase } from "./supabase";

export interface LedgerSummaryRow {
  account_code: string;
  account_name: string;
  account_type: string;
  owner_user_id: string | null;
  loan_application_id: number | null;
  balance: number;
}

export interface FundingHoldRow {
  id: string;
  investment_id: number;
  loan_application_id: number;
  investor_id: string;
  amount: number;
  status: string;
  hold_until: string;
  released_at: string | null;
  created_at: string;
}

export interface ReconciliationRow {
  id: string;
  event_type: string;
  status: string;
  reference_type: string | null;
  reference_id: string | null;
  expected_amount: number | null;
  actual_amount: number | null;
  difference_amount: number | null;
  notes: string | null;
  created_at: string;
}

export async function loadLedgerSummary(): Promise<LedgerSummaryRow[]> {
  const { data, error } = await supabase
    .from("financial_account_balances")
    .select("account_code,account_name,account_type,owner_user_id,loan_application_id,balance")
    .order("account_type")
    .order("account_name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, balance: Number(row.balance || 0) })) as LedgerSummaryRow[];
}

export async function loadFundingHolds(): Promise<FundingHoldRow[]> {
  const { data, error } = await supabase
    .from("funding_holds")
    .select("id,investment_id,loan_application_id,investor_id,amount,status,hold_until,released_at,created_at")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount || 0) })) as FundingHoldRow[];
}

export async function loadReconciliationEvents(): Promise<ReconciliationRow[]> {
  const { data, error } = await supabase
    .from("financial_reconciliation_events")
    .select("id,event_type,status,reference_type,reference_id,expected_amount,actual_amount,difference_amount,notes,created_at")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    expected_amount: row.expected_amount == null ? null : Number(row.expected_amount),
    actual_amount: row.actual_amount == null ? null : Number(row.actual_amount),
    difference_amount: row.difference_amount == null ? null : Number(row.difference_amount),
  })) as ReconciliationRow[];
}

export async function releaseExpiredFundingHolds() {
  const { data, error } = await supabase.rpc("release_expired_funding_holds_v35");
  if (error) throw error;
  return data;
}

export async function disburseLoanFunds(loanApplicationId: number, amount: number, note?: string) {
  const { data, error } = await supabase.rpc("disburse_loan_funds_v35", {
    p_loan_application_id: loanApplicationId,
    p_amount: amount,
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}
