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
        error: "Missing Supabase server environment variables.",
      });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing user auth token." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid user token." });
    }

    const depositAmount = Number(req.body?.amount);

    if (!depositAmount || depositAmount < 1) {
      return res.status(400).json({ error: "Enter a valid deposit amount." });
    }

    const { data: bankAccount, error: bankError } = await supabase
      .from("investor_bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bankError) {
      return res.status(500).json({ error: bankError.message });
    }

    if (!bankAccount) {
      return res.status(400).json({
        error: "No connected bank account found. Connect a bank first.",
      });
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
        })
        .select()
        .single();

      if (createWalletError) {
        return res.status(500).json({ error: createWalletError.message });
      }

      wallet = newWallet;
    }

    const { data: reserve } = await supabase
      .from("platform_reserve_account")
      .select("*")
      .limit(1)
      .maybeSingle();

    const reservePercent = Number(reserve?.target_percent || 1);
    const reserveAmount = Number(((depositAmount * reservePercent) / 100).toFixed(2));
    const walletCredit = Number((depositAmount - reserveAmount).toFixed(2));

    const newWalletBalance = Number(wallet.available_balance || 0) + walletCredit;

    const { data: updatedWallet, error: updateWalletError } = await supabase
      .from("investor_wallets")
      .update({
        available_balance: newWalletBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateWalletError) {
      return res.status(500).json({ error: updateWalletError.message });
    }

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        transaction_type: "deposit",
        amount: walletCredit,
        loan_id: null,
        status: "completed",
        description: `Wallet deposit completed. Gross deposit: $${depositAmount}. Reserve withheld: $${reserveAmount}.`,
      });

    if (transactionError) {
      return res.status(500).json({ error: transactionError.message });
    }

    const { error: ledgerError } = await supabase
      .from("accounting_ledger")
      .insert([
        {
          user_id: user.id,
          loan_id: null,
          transaction_type: "deposit",
          debit_account: "Platform Cash",
          credit_account: "Investor Wallet Liability",
          amount: walletCredit,
          description: "Investor deposit credited to wallet balance.",
        },
        {
          user_id: user.id,
          loan_id: null,
          transaction_type: "reserve_allocation",
          debit_account: "Platform Cash",
          credit_account: "Platform Reserve",
          amount: reserveAmount,
          description: "Reserve allocation from investor deposit.",
        },
      ]);

    if (ledgerError) {
      return res.status(500).json({ error: ledgerError.message });
    }

    if (reserve && reserveAmount > 0) {
      const { error: reserveError } = await supabase
        .from("platform_reserve_account")
        .update({
          balance: Number(reserve.balance || 0) + reserveAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reserve.id);

      if (reserveError) {
        return res.status(500).json({ error: reserveError.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Deposit completed and recorded.",
      deposit_amount: depositAmount,
      wallet_credit: walletCredit,
      reserve_amount: reserveAmount,
      wallet: updatedWallet,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Deposit failed.",
    });
  }
}