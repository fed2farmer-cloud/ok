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

    const { amount } = req.body;
    const depositAmount = Number(amount);

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

    let { data: wallet } = await supabase
      .from("investor_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

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

    const newBalance =
      Number(wallet.available_balance || 0) + depositAmount;

    const { data: updatedWallet, error: updateError } = await supabase
      .from("investor_wallets")
      .update({
        available_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({
      success: true,
      message: "Deposit added to wallet.",
      wallet: updatedWallet,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Deposit failed.",
    });
  }
}