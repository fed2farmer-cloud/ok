import { supabase } from "../../lib/supabase";

export type PortfolioRow = {
  investment_id: number;
  investor_id: string;
  current_owner_id: string;
  original_investor_id: string;
  certificate_uuid: string;
  certificate_number: string;
  certificate_issued_at: string;
  transfer_count: number;
  transfer_locked: boolean;
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

  // Do not depend on investor_portfolio_v29 existing in the database. Read the
  // source rows and resolve the public loan number from loan_applications.
  const { data: investments, error: investmentError } = await supabase
    .from("investments")
    .select("*")
    .or(`investor_id.eq.${auth.user.id},current_owner_id.eq.${auth.user.id}`)
    .order("created_at", { ascending: false });
  if (investmentError) throw investmentError;

  const owned = (investments ?? []).filter(
    (row: any) => (row.current_owner_id ?? row.investor_id) === auth.user!.id
  );
  const applicationIds = [...new Set(
    owned.map((row: any) => row.loan_application_id ?? row.loan_id).filter(Boolean)
  )];

  let loanById = new Map<any, any>();
  if (applicationIds.length) {
    const { data: loans, error: loanError } = await supabase
      .from("loan_applications")
      .select("id,loan_number,business_name")
      .in("id", applicationIds);
    if (loanError) throw loanError;
    loanById = new Map((loans ?? []).map((loan: any) => [loan.id, loan]));
  }

  return owned.map((row: any) => {
    const applicationId = row.loan_application_id ?? row.loan_id;
    const loan = loanById.get(applicationId);
    const expiresAt = row.protection_expires_at ?? row.refund_deadline ?? null;
    const protectedNow = row.status === "protection_period" && !!expiresAt && new Date(expiresAt).getTime() > Date.now();
    const displayStatus = protectedNow ? "Protected"
      : ["refund_requested", "refund_processing"].includes(row.status) ? "Refund Processing"
      : row.status === "refunded" ? "Refunded"
      : ["settled", "active"].includes(row.status) ? "Active"
      : row.status === "cancelled" ? "Cancelled"
      : row.status === "failed" ? "Failed"
      : String(row.status || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      investment_id: row.id,
      investor_id: row.investor_id,
      current_owner_id: row.current_owner_id ?? row.investor_id,
      original_investor_id: row.original_investor_id ?? row.investor_id,
      certificate_uuid: row.certificate_uuid ?? "",
      certificate_number: row.certificate_number ?? "",
      certificate_issued_at: row.certificate_issued_at ?? row.created_at,
      transfer_count: Number(row.transfer_count ?? 0),
      transfer_locked: Boolean(row.transfer_locked),
      internal_loan_id: row.loan_id,
      public_loan_number: Number(loan?.loan_number ?? row.loan_number ?? applicationId),
      business_name: loan?.business_name ?? "Investment",
      amount: Number(row.amount ?? 0),
      investor_interest_rate: row.investor_interest_rate,
      term_months: row.term_months,
      status: row.status,
      display_status: displayStatus,
      created_at: row.created_at,
      refund_policy_enabled: Boolean(row.refund_policy_enabled),
      refund_period_days: Number(row.refund_period_days ?? 7),
      protection_expires_at: expiresAt,
      refund_eligible: protectedNow,
    } as PortfolioRow;
  });
}

export async function requestRefundV29(investmentId: number, reason = "") {
  const { data, error } = await supabase.rpc("request_investment_refund_v28", {
    p_investment_id: investmentId,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data;
}
