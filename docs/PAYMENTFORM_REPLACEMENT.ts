import { createProtectedInvestment } from "../features/investorProtection/investorProtectionService";

async function saveInvestmentAfterPayment(loanApplicationId: number, amount: number) {
  return await createProtectedInvestment(loanApplicationId, amount);
}

// Use loan_applications.id as loanApplicationId.
// Do not use the marketplace UUID or public six-digit loan number.
