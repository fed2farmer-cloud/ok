import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseNmi(text: string) {
  const p = new URLSearchParams(text.trim());
  return {
    approved: p.get("response") === "1",
    transactionId: p.get("transactionid") || p.get("transaction_id") || "",
    responseText: p.get("responsetext") || p.get("response_text") || text.slice(0, 500),
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ success: false, error: "Missing Supabase server configuration." });
    }

    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ success: false, error: "Please sign in again." });

    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ success: false, error: "Unauthorized." });

    const paymentToken = String(req.body?.paymentToken || "");
    const amount = Number(req.body?.amount);
    if (!paymentToken || !Number.isFinite(amount) || amount < 10) {
      return res.status(400).json({ success: false, error: "A payment token and minimum $10 deposit are required." });
    }

    const apiKey = process.env.NMI_API_KEY;
    const nmiEnvironment = String(process.env.NMI_ENVIRONMENT || "sandbox").toLowerCase();
    const endpoint = nmiEnvironment === "production" || nmiEnvironment === "live"
      ? "https://secure.nmi.com/api/transact.php"
      : "https://sandbox.nmi.com/api/transact.php";
    if (!apiKey) return res.status(500).json({ success: false, error: "NMI is not configured." });

    const params = new URLSearchParams({
      security_key: apiKey,
      type: "sale",
      payment_token: paymentToken,
      amount: amount.toFixed(2),
    });

    const nmiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const raw = await nmiRes.text();
    const nmi = parseNmi(raw);

    if (!nmi.approved || !nmi.transactionId) {
      return res.status(402).json({ success: false, error: nmi.responseText || "Card payment was not approved." });
    }

    // The live database currently has credit_nmi_wallet(), created during the
    // wallet repair. Use that exact function so an approved NMI payment is
    // immediately recorded in nmi_payment_transactions and credited to cash.
    const { data: newBalance, error: creditError } = await db.rpc("credit_nmi_wallet", {
      p_user_id: user.id,
      p_nmi_transaction_id: nmi.transactionId,
      p_gross: amount,
      p_fee: 0,
      p_reserve: 0,
    });

    if (creditError) {
      console.error("NMI approved but wallet credit failed", {
        userId: user.id,
        transactionId: nmi.transactionId,
        amount,
        error: creditError,
      });
      return res.status(500).json({
        success: false,
        paymentApproved: true,
        transactionId: nmi.transactionId,
        error: `Payment approved (#${nmi.transactionId}) but wallet credit failed. Do not retry the card; contact support for reconciliation.`,
      });
    }

    // Add a visible wallet-history row. Failure here must not reverse or hide
    // the successful processor charge / wallet credit.
    const description = `NMI card deposit. Processor transaction #${nmi.transactionId}.`;
    const { data: existingTx } = await db
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("description", description)
      .maybeSingle();

    if (!existingTx) {
      const { error: historyError } = await db.from("wallet_transactions").insert({
        user_id: user.id,
        transaction_type: "deposit",
        amount,
        status: "completed",
        description,
      });
      if (historyError) console.error("Wallet credited but history insert failed", historyError);
    }

    return res.status(200).json({
      success: true,
      transactionId: nmi.transactionId,
      amount,
      availableBalance: Number(newBalance),
    });
  } catch (e: any) {
    console.error("Wallet card deposit error", e);
    return res.status(500).json({ success: false, error: e?.message || "Card deposit failed." });
  }
}
