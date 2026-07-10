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
      return res.status(400).json({ error: "Enter a valid deposit amount." });
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

    let { data: wallet, error: walletError } = await supabase
      .from("investor_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletError) {
      return res.status(500).json({ error: walletError.message });
    }

    if (!wallet) {
      const { data: newWallet, error: createWalletError } = await supabase
        .from("investor_wallets")
        .insert({
          user_id: user.id,
          available_balance: 0,
          invested_balance: 0,
          earned_interest: 0,
          pending_balance: 0,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createWalletError) {
        return res.status(500).json({ error: createWalletError.message });
      }

      wallet = newWallet;
    }

    // Transparent wallet policy: credit 100% of the investor deposit.
    // No reserve, holdback, or automatic percentage deduction is applied.
    const walletCredit = Number(amount.toFixed(2));

    const newAvailableBalance = Number(
      (Number(wallet.available_balance || 0) + walletCredit).toFixed(2)
    );

    const { data: updatedWallet, error: updateWalletError } = await supabase
      .from("investor_wallets")
      .update({
        available_balance: newAvailableBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateWalletError) {
      return res.status(500).json({ error: updateWalletError.message });
    }

    const bankName =
      bankAccount.bank_name ||
      bankAccount.institution_name ||
      "Linked bank account";

    const accountMask =
      bankAccount.account_mask ||
      bankAccount.account_number?.slice(-4) ||
      bankAccount.plaid_account_id?.slice(-4) ||
      "";

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        transaction_type: "deposit",
        amount: walletCredit,
        status: "completed",
        description: `Deposit from ${bankName}${
          accountMask ? " ••••" + accountMask : ""
        }. Full deposit credited to available cash.`,
      });

    if (transactionError) {
      return res.status(500).json({ error: transactionError.message });
    }

    const { error: ledgerError } = await supabase
      .from("accounting_ledger")
      .insert({
        user_id: user.id,
        transaction_type: "deposit",
        debit_account: "Platform Cash",
        credit_account: "Investor Wallet Liability",
        amount: walletCredit,
        description: "Full investor deposit credited to available wallet cash.",
      });

    if (ledgerError) {
      return res.status(500).json({ error: ledgerError.message });
    }

    return res.status(200).json({
      success: true,
      message: "Deposit completed.",
      deposit_amount: amount,
      wallet_credit: walletCredit,
      wallet: updatedWallet,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Deposit failed.",
    });
  }
}