import { supabase } from "./supabase";

export async function investFromWalletAtomic(loanId: number, amount: number) {
  if (!Number.isFinite(amount) || amount < 100) throw new Error("Minimum investment is $100.");

  const idempotencyKey =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}-${loanId}`;

  const { data, error } = await supabase.rpc("invest_from_wallet_atomic", {
    p_loan_id: loanId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  return data;
}
