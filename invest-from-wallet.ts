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

    const loanId = Number(req.body?.loan_id);
    const investAmount = Number(req.body?.amount);

    if (!loanId) {
      return res.status(400).json({ error: "Missing loan ID." });
    }

    if (!investAmount || investAmount < 100) {
      return res.status(400).json({
        error: "Minimum investment is $100.",
      });
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
        error: `Insufficient wallet balance. Available: $${availableBalance.toFixed(
          2
        )}`,
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

    if (amountRemaining <= 0 || loan.status === "Funded") {
      return res.status(400).json({
        error: "This loan is already fully funded.",
      });
    }

    if (investAmount > amountRemaining) {
      return res.status(400).json({
        error: `Investment exceeds remaining loan amount. Remaining: $${amountRemaining.toFixed(
          2
        )}`,
      });
    }

    const investorRate = Number(loan.investor_interest_rate || 9);
    const borrowerRate = Number(loan.borrower_interest_rate || 10);
    const companySpread = Number(loan.company_spread_rate || 1);
    const termMonths = Number(loan.repayment_term_months || 36);

    const newWalletBalance = Number(
      (availableBalance - investAmount).toFixed(2)
    );

    const newInvestedBalance = Number(
      (Number(wallet.invested_balance || 0) + investAmount).toFixed(2)
    );

    const newAmountFunded = Number((amountFunded + investAmount).toFixed(2));
    const newAmountRemaining = Number(
      Math.max(fundingGoal - newAmountFunded, 0).toFixed(2)
    );

    const loanStatus = newAmountRemaining <= 0 ? "Funded" : "Open";

    const { data: updatedWallet, error: updateWalletError } = await supabase
      .from("investor_wallets")
      .update({
        available_balance: newWalletBalance,
        invested_balance: newInvestedBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateWalletError) {
      return res.status(500).json({ error: updateWalletError.message });
    }

    const { data: updatedLoan, error: updateLoanError } = await supabase
      .from("marketplace_loans")
      .update({
        amount_funded: newAmountFunded,
        amount_remaining: newAmountRemaining,
        status: loanStatus,
      })
      .eq("loan_application_id", loanId)
      .select()
      .single();

    if (updateLoanError) {
      return res.status(500).json({ error: updateLoanError.message });
    }

    await supabase
      .from("loan_applications")
      .update({
        amount_funded: newAmountFunded,
        amount_remaining: newAmountRemaining,
        status: loanStatus === "Funded" ? "Funded" : "Approved",
      })
      .eq("Id", loanId);

    const { data: investment, error: investmentError } = await supabase
      .from("investments")
      .insert({
        investor_id: user.id,
        loan_id: loanId,
        amount: investAmount,
        investor_interest_rate: investorRate,
        borrower_interest_rate: borrowerRate,
        company_spread_rate: companySpread,
        term_months: termMonths,
        status: "active",
      })
      .select()
      .single();

    if (investmentError) {
      return res.status(500).json({ error: investmentError.message });
    }

    const { error: transactionError } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        transaction_type: "investment",
        amount: -Math.abs(investAmount),
        loan_id: loanId,
        status: "completed",
        description: `Investment funded from wallet for Loan #${loanId}.`,
      });

    if (transactionError) {
      return res.status(500).json({ error: transactionError.message });
    }

    const { error: ledgerError } = await supabase
      .from("accounting_ledger")
      .insert([
        {
          user_id: user.id,
          loan_id: loanId,
          transaction_type: "investment",
          debit_account: "Loan Funding Asset",
          credit_account: "Investor Wallet Liability",
          amount: investAmount,
          description: `Investor wallet funds applied to Loan #${loanId}.`,
        },
        {
          user_id: user.id,
          loan_id: loanId,
          transaction_type: "investment_commitment",
          debit_account: "Investor Investment Balance",
          credit_account: "Platform Cash",
          amount: investAmount,
          description: `Investment commitment recorded for Loan #${loanId}.`,
        },
      ]);

    if (ledgerError) {
      return res.status(500).json({ error: ledgerError.message });
    }

    return res.status(200).json({
      success: true,
      message: "Investment funded from wallet.",
      wallet: updatedWallet,
      investment,
      loan: updatedLoan,
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