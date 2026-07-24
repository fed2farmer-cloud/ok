// PaymentForm / Marketplace investment integration
// Replace the old manual investment insert and marketplace update logic.

import { investFromWallet } from "../features/investorProtection/investorProtectionService";

async function handleInvestFromWallet() {
  const publicLoanNumber = Number(loanNumber); // Example: 889568
  const investmentAmount = Number(amount);

  try {
    await investFromWallet(publicLoanNumber, investmentAmount);

    alert("Investment completed from available cash.");
    navigate("/portfolio");
  } catch (error) {
    alert(error instanceof Error ? error.message : "Investment failed.");
  }
}

// IMPORTANT:
// Pass marketplace_loans.loan_number (889568).
// The database function resolves it to loan_application_id (13).
