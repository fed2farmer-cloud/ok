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

    const loanId = Number(req.body?.loan_id);
    const investAmount = Number(req.body?.amount);

    if (!loanId) {
      return res.status(400).json({ error: "Missing loan ID." });
    }

    if (!investAmount || investAmount < 1) {
      return res.status(400).json({ error: "Enter a valid investment amount." });
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
      return res.status(400).json({ error: "Investor wallet not found." });
    }

    const availableBalance = Number(wallet.available_balance || 0);

    if (availableBalance < investAmount) {
      return res.status(400).json({
        error: `Insufficient wallet balance. Available: $${availableBalance}`,
      });
    }

    const { data: loan, error: loanError } = await supabase
      .from("marketplace_loans")
      .select("*")
      .eq("loan_application_id", loanId)
      .maybeSingle();

    if (loanError) {
      return res.status(500).json({ error: loanError.message });
    }

    if (!loan) {
      return res.status(404).json({ error: "Marketplace loan not found." });
    }

    const amountFunded = Number(loan.amount_funded || 0);
    const fundingGoal = Number(loan.funding_goal || loan.loan_amount || 0);
    const amountRemaining = Math.max(fundingGoal - amountFunded, 0);

    if (investAmount > amountRemaining) {
      return res.status(400).json({
        error: `Investment exceeds remaining loan amount. Remaining: $${amountRemaining}`,
      });
    }

    const newWalletBalance = availableBalance - investAmount;
    const newInvestedBalance = Number(wallet.invested_balance || 0) + investAmount;

    const newAmountFunded = amountFunded + investAmount;
    const newAmountRemaining = Math.max(fundingGoal - newAmountFunded, 0);
    const loanStatus = newAmountRemaining <= 0 ? "Funded" : "Open";

    const investorRate = Number(loan.investor_interest_rate || 9);
    const borrowerRate = Number(loan.borrower_interest_rate || 10);
    const companySpread = Number(loan.company_spread_rate || 1);
    const termMonths = Number(loan.repayment_term_months || 36);

    const { error: updateWalletError } = await supabase
      .from("investor_wallets")
      .update({
        available_balance: newWalletBalance,
        invested_balance: newInvestedBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateWalletError) {
      return res.status(500).json({ error: updateWalletError.message });
    }

    const { error: updateLoanError } = await supabase
      .from("marketplace_loans")
      .update({
        amount_funded: newAmountFunded,
        amount_remaining: newAmountRemaining,
        status: loanStatus,
      })
      .eq("loan_application_id", loanId);

    if (updateLoanError) {
      return res.status(500).json({ error: updateLoanError.message });
    }

    const { error: investmentError } = await supabase.from("investments").insert({
      investor_id: user.id,
      loan_id: loanId,
      amount: investAmount,
      investor_interest_rate: investorRate,
      borrower_interest_rate: borrowerRate,
      company_spread_rate: companySpread,
      term_months: termMonths,
      status: "active",
    });

    if (investmentError) {
      return res.status(500).json({ error: investmentError.message });
    }

    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      transaction_type: "investment",
      amount: investAmount,
      loan_id: loanId,
      status: "completed",
      description: `Investor funded loan ${loanId} from wallet balance.`,
    });

    await supabase.from("accounting_ledger").insert([
      {
        user_id: user.id,
        loan_id: loanId,
        transaction_type: "investment",
        debit_account: "Loan Funding Asset",
        credit_account: "Investor Wallet Liability",
        amount: investAmount,
        description: `Investor wallet funds applied to loan ${loanId}.`,
      },
      {
        user_id: user.id,
        loan_id: loanId,
        transaction_type: "investment_commitment",
        debit_account: "Investor Investment Balance",
        credit_account: "Platform Cash",
        amount: investAmount,
        description: `Investor investment recorded for loan ${loanId}.`,
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Investment funded from wallet.",
      wallet_balance: newWalletBalance,
      invested_balance: newInvestedBalance,
      loan_amount_funded: newAmountFunded,
      loan_amount_remaining: newAmountRemaining,
      loan_status: loanStatus,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Wallet investment failed.",
    });
  }
}