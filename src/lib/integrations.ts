export const API_BASE = import.meta.env.VITE_RAILWAY_API_URL || "";

async function postToRailway<T>(path: string, payload: unknown): Promise<T> {
  if (!API_BASE) {
    return {
      demo: true,
      message: "Railway API URL not set yet. Add VITE_RAILWAY_API_URL after the backend is deployed.",
      payload,
    } as T;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createPlaidLinkToken(userId: string, dealId: string) {
  return postToRailway("/api/plaid/create-link-token", { userId, dealId });
}

export function verifyPlaidAccount(publicToken: string, dealId: string) {
  return postToRailway("/api/plaid/exchange-public-token", { publicToken, dealId });
}

/** Order a ReportAll property report. Uses Vercel API function directly. */
export async function orderReportAllPropertyReport(
  dealId: string,
  county: string,
  state: string,
  ownerName: string,
  apn?: string
) {
  const response = await fetch("/api/reportall-property-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, county, state, ownerName, apn }),
  });
  if (!response.ok) {
    throw new Error(`ReportAll request failed: ${response.status}`);
  }
  return response.json();
}

export function createInvestorReservation(dealId: string, investorName: string, amount: number) {
  return postToRailway("/api/investments/reserve", { dealId, investorName, amount });
}
