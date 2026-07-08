import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: "Missing Supabase environment variables.",
      });
    }

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing auth token." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const amount = Number(req.body?.amount);
    const bankAccountId = req.body?.bank_account_id;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Enter a valid withdrawal amount." });
    }

    if (!bankAccountId) {
      return res.status(400).json({ error: "Select a bank account." });
    }

    const { data: bankAccount, error: bankError } = await supabase
      .from("investor_bank_accounts")
      .select("*")
      .eq("id", bankAccountId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (bankError) {
      return res.status(500).json({ error: bankError.message });
    }

    if (!bankAccount) {
      return res.status(400).json({ error: "Bank account not found." });
    }

    const { data: wallet, error: walletError } = await supabase
      .from("investor_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletError) {
      return res.status(500).json({ error: walletError.message });
    }

    if (!wallet) {
      return res.status(400).json({ error: "Wallet not found." });
    }

    const availableBalance = Number(wallet.available_balance || 0);

    if (availableBalance < amount) {
      return res.status(400).json({
        error: `Insufficient funds. Available balance: $${availableBalance}`,
      });
    }

    const newBalance = availableBalance - amount;

    const { data: updatedWallet, error: updateWalletError } = await supabase
      .from("investor_wallets")
      .update({
        available_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateWalletError) {
      return res.status(500).json({ error: updateWalletError.message });
    }

    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      transaction_type: "withdrawal",
      amount,
      status: "pending",
      description: `Withdrawal requested to ${bankAccount.bank_name || "bank"} ${
        bankAccount.account_mask ? "••••" + bankAccount.account_mask : ""
      }.`,
    });

    await supabase.from("accounting_ledger").insert({
      user_id: user.id,
      transaction_type: "withdrawal",
      debit_account: "Investor Wallet Liability",
      credit_account: "Platform Cash",
      amount,
      description: "Investor withdrawal requested.",
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal requested.",
      wallet: updatedWallet,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Withdrawal failed.",
    });
  }
}