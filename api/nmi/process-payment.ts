import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { loanId, amount, paymentToken } = req.body;

    if (!loanId || !amount || !paymentToken) {
      return res.status(400).json({
        error: "Missing loanId, amount, or paymentToken",
      });
    }

    const nmiKey = process.env.NMI_SECURITY_KEY;
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!nmiKey || !supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: "Missing server environment variables",
      });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const userClient = createClient(
      supabaseUrl,
      process.env.VITE_SUPABASE_ANON_KEY || ""
    );

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid user session" });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: loan, error: loanError } = await admin
      .from("loan_applications")
      .select("*")
      .eq("Id", loanId)
      .single();

    if (loanError || !loan) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const paymentAmount = Number(amount);

    if (paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid investment amount" });
    }

    const nmiBody = new URLSearchParams({
      security_key: nmiKey,
      type: "sale",
      amount: paymentAmount.toFixed(2),
      payment_token: paymentToken,
      orderid: `loan-${loanId}-${Date.now()}`,
    });

    const nmiResponse = await fetch("https://secure.nmi.com/api/transact.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: nmiBody.toString(),
    });

    const nmiText = await nmiResponse.text();
    const nmiResult = Object.fromEntries(new URLSearchParams(nmiText));

    if (nmiResult.response !== "1") {
      return res.status(400).json({
        error: nmiResult.responsetext || "NMI payment declined",
        nmi: nmiResult,
      });
    }

    const { error: investmentError } = await admin.from("investments").insert({
      loan_id: Number(loanId),
      investor_id: user.id,
      amount: paymentAmount,
    });

    if (investmentError) {
      return res.status(500).json({
        error: investmentError.message,
      });
    }

    const { data: investments } = await admin
      .from("investments")
      .select("amount")
      .eq("loan_id", Number(loanId));

    const totalFunded =
      investments?.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 0;

    if (totalFunded >= Number(loan.loan_amount || 0)) {
      await admin
        .from("loan_applications")
        .update({ status: "Funded" })
        .eq("Id", loanId);
    }

    return res.status(200).json({
      success: true,
      message: "Investment processed successfully",
      transactionId: nmiResult.transactionid,
      fundedAmount: totalFunded,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Payment processing failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}