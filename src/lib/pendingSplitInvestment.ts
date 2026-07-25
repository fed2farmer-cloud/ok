export type PendingSplitInvestment = {
  version: 1;
  loanNumber: string | number;
  loanApplicationId: string | number;
  marketplaceLoanId: number;
  totalAmount: number;
  walletAmount: number;
  externalAmount: number;
  externalMethod: "card";
  createdAt: string;
};

const STORAGE_KEY = "securedlanding_pending_split_investment";

export function readPendingSplitInvestment(): PendingSplitInvestment | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingSplitInvestment;

    if (
      parsed.version !== 1 ||
      !Number.isFinite(parsed.totalAmount) ||
      !Number.isFinite(parsed.walletAmount) ||
      !Number.isFinite(parsed.externalAmount)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSplitInvestment(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
