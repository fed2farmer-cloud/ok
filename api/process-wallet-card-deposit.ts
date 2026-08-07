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
  if (req.method !== "POST") return res.status(405).json({ success:false, error:"Method not allowed" });
  try {
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ success:false, error:"Missing Supabase server configuration." });
    const token = String(req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ success:false, error:"Please sign in again." });
    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data:{ user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ success:false, error:"Unauthorized." });

    const paymentToken = String(req.body?.paymentToken || "");
    const amount = Number(req.body?.amount);
    if (!paymentToken || !Number.isFinite(amount) || amount < 10) return res.status(400).json({ success:false, error:"A payment token and minimum $10 deposit are required." });

    const apiKey = process.env.NMI_API_KEY;
    const endpoint = process.env.NMI_API_ENDPOINT || "https://secure.nmi.com/api/transact.php";
    if (!apiKey) return res.status(500).json({ success:false, error:"NMI is not configured." });

    const params = new URLSearchParams({ security_key: apiKey, type:"sale", payment_token:paymentToken, amount:amount.toFixed(2) });
    const nmiRes = await fetch(endpoint, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:params.toString() });
    const raw = await nmiRes.text();
    const nmi = parseNmi(raw);
    if (!nmi.approved || !nmi.transactionId) return res.status(402).json({ success:false, error:nmi.responseText || "Card payment was not approved." });

    const { data: credit, error: creditError } = await db.rpc("credit_nmi_wallet_deposit_v1", {
      p_user_id:user.id, p_nmi_transaction_id:nmi.transactionId, p_gross_amount:amount, p_response_text:nmi.responseText
    });
    if (creditError) {
      console.error("NMI approved but wallet credit failed", { userId:user.id, transactionId:nmi.transactionId, amount, error:creditError });
      return res.status(500).json({ success:false, paymentApproved:true, transactionId:nmi.transactionId,
        error:`Payment approved (#${nmi.transactionId}) but wallet credit failed. Do not retry the card; contact support for reconciliation.` });
    }
    return res.status(200).json({ success:true, transactionId:nmi.transactionId, amount, wallet:credit });
  } catch (e:any) {
    console.error("Wallet card deposit error", e);
    return res.status(500).json({ success:false, error:e?.message || "Card deposit failed." });
  }
}
